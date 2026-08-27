import { useEffect, useRef, useState } from 'react'
import InvoiceReceiptModal from './InvoiceReceiptModal'
import { apiRequest as request } from '../../utils/apiClient'

const presetValues = [0.25, 0.5, 1, 2, 3, 5, 10, 20]

const toLocalDate = (value) => {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMoney = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0))

function VendorPointOfSale({ user, raffles = [], raffleTypes = [], onSaleCompleted }) {
  const [invoice, setInvoice] = useState(null)
  const [unavailableNumbers, setUnavailableNumbers] = useState([])
  const [form, setForm] = useState({ raffleId: '', saleDate: toLocalDate(new Date()), number: '', value: '1', quantity: '1' })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [printedInvoice, setPrintedInvoice] = useState(null)
  const [invoiceSettings, setInvoiceSettings] = useState(null)
  const dateInputRef = useRef(null)
  const numberInputRef = useRef(null)
  const paymentInFlightRef = useRef(false)

  const rafflesForSelectedDate = raffles.filter((raffle) => toLocalDate(raffle.fecha_hora_juego) === form.saleDate)
  const selectedRaffle = rafflesForSelectedDate.find((raffle) => raffle.id === Number(form.raffleId))
  const selectedRaffleType = raffleTypes.find((type) => type.id === selectedRaffle?.id_tipo)
  const posTheme = selectedRaffleType
    ? { '--pos-primary': selectedRaffleType.color_primario, '--pos-secondary': selectedRaffleType.color_secundario }
    : undefined

  useEffect(() => {
    if (!error) return undefined
    if (error.toLowerCase().includes('fuera de horario') || error.toLowerCase().includes('horario de venta')) return undefined

    const timeout = window.setTimeout(() => setError(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [error])

  const loadInvoice = async (invoiceNumber) => {
    const data = await request(`/api/sales/windows/${user.id}/${invoiceNumber}`)
    setInvoice(data)
  }

  const openWindow = async () => {
    const data = await request('/api/sales/windows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_usuario: user.id }),
    })
    await loadInvoice(data.numero_factura)
  }

  useEffect(() => {
    const loadPos = async () => {
      try {
        setIsLoading(true)
        setError('')
        await openWindow()
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadPos()
  }, [user.id])

  useEffect(() => {
    let cancelled = false
    request(`/api/invoice-settings/${user.id}`)
      .then((settings) => { if (!cancelled) setInvoiceSettings(settings) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user.id])

  useEffect(() => {
    const loadUnavailableNumbers = async () => {
      if (!selectedRaffle) {
        setUnavailableNumbers([])
        return
      }

      try {
        const cache = await request(`/api/vendors/${user.id}/raffles/${selectedRaffle.id}/prepare-quota-cache`, { method: 'POST' })
        setUnavailableNumbers(cache.unavailableNumbers)
      } catch (requestError) {
        setError(requestError.message)
      }
    }

    loadUnavailableNumbers()
  }, [selectedRaffle?.id])

  const handleChange = (event) => {
    const { name, value } = event.target
    const newValue = name === 'number' ? value.replace(/\D/g, '') : value
    setForm((currentForm) => ({
      ...currentForm,
      [name]: newValue,
      ...(name === 'saleDate' ? { raffleId: '', number: '' } : {}),
    }))
    if (name === 'saleDate') setUnavailableNumbers([])
  }

  const handleNumberKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  const openDatePicker = () => {
    const dateInput = dateInputRef.current
    if (!dateInput || isSaving) return

    if (typeof dateInput.showPicker === 'function') dateInput.showPicker()
    else dateInput.focus()
  }

  const handleAddToCart = async (event) => {
    event.preventDefault()
    if (!invoice) return

    try {
      setIsSaving(true)
      setError('')
      const number = form.number.trim()
      if (!selectedRaffle) throw new Error('Selecciona una rifa')
      if (!number) throw new Error('Ingresa un numero')
      if (!/^\d+$/.test(number)) throw new Error('El numero solo debe contener digitos numericos (0-9)')
      if (unavailableNumbers.includes(number)) throw new Error('Este numero ya no esta disponible')
      const quantity = Number(form.quantity)
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error('La cantidad debe ser un numero entero mayor o igual a 1')

      await request(`/api/raffles/${selectedRaffle.id}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: user.id,
          numero_factura: invoice.numero_factura,
          numbers: [number],
          valor: Number(form.value),
          cantidad: quantity,
        }),
      })
      await loadInvoice(invoice.numero_factura)
      setUnavailableNumbers(await request(`/api/vendors/${user.id}/raffles/${selectedRaffle.id}/unavailable-numbers`))
      setForm((currentForm) => ({ ...currentForm, number: '', quantity: '1' }))
      window.requestAnimationFrame(() => numberInputRef.current?.focus())
    } catch (requestError) {
      if (requestError.message.startsWith('RIFA_DIFERENTE:')) {
        const cleanMessage = requestError.message.replace('RIFA_DIFERENTE: ', '')
        if (window.confirm(`${cleanMessage}\n\nAceptar: elimina la factura actual y abre una nueva.\nCancelar: no hace nada y mantiene la factura actual.`)) {
          try {
            await resetInvoiceWindow()
          } catch (resetError) {
            setError(resetError.message)
            setIsSaving(false)
          }
        }
        return
      }
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const resetInvoiceWindow = async () => {
    setIsSaving(true)
    setError('')
    await request(`/api/sales/windows/${user.id}/${invoice.numero_factura}`, { method: 'DELETE' })
    await openWindow()
    if (selectedRaffle) {
      const cache = await request(`/api/vendors/${user.id}/raffles/${selectedRaffle.id}/prepare-quota-cache`, { method: 'POST' })
      setUnavailableNumbers(cache.unavailableNumbers)
    }
    setIsSaving(false)
  }

  const handleClear = async () => {
    if (!invoice || !window.confirm('Limpiar esta venta y abrir una factura nueva?')) return
    try {
      await resetInvoiceWindow()
    } catch (requestError) {
      setError(requestError.message)
      setIsSaving(false)
    }
  }

  const handleRemoveSale = async (sale) => {
    if (!invoice || !window.confirm(`Eliminar el numero ${sale.numero} del carrito?`)) return
    try {
      setIsSaving(true)
      setError('')
      const updatedInvoice = await request(`/api/sales/windows/${user.id}/${invoice.numero_factura}/items/${sale.id}`, { method: 'DELETE' })
      setInvoice(updatedInvoice)
      const raffleForSale = raffles.find((raffle) => raffle.id === sale.id_rifa)
      if (raffleForSale) {
        setUnavailableNumbers(await request(`/api/vendors/${user.id}/raffles/${raffleForSale.id}/unavailable-numbers`))
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePay = async () => {
    if (!invoice || invoice.sales.length === 0 || paymentInFlightRef.current) return
    paymentInFlightRef.current = true
    try {
      setIsSaving(true)
      setIsProcessingPayment(true)
      setError('')
      const payment = await request(`/api/sales/windows/${user.id}/${invoice.numero_factura}/pay`, { method: 'POST' })
      const fastInvoice = {
        id: payment.id_factura,
        id_usuario: user.id,
        numero_factura: payment.numero_factura || invoice.numero_factura,
        created_at: new Date().toISOString(),
        usuario: user,
        total: invoice.total,
        ventas: invoice.sales.map((sale) => ({
          ...sale,
          cantidad: sale.cantidad || 1,
          total: sale.total || sale.valor * (sale.cantidad || 1),
          rifa: raffles.find((raffle) => raffle.id === sale.id_rifa) || null,
        })),
      }
      let finalInvoice = fastInvoice
      try {
        const detailedInvoice = await request(`/api/invoices/${payment.id_factura}`)
        if (detailedInvoice && detailedInvoice.id) finalInvoice = detailedInvoice
      } catch {
        // Fallback to fastInvoice
      }
      setPrintedInvoice(finalInvoice)
      const settings = await request(`/api/invoice-settings/${user.id}`).catch(() => invoiceSettings)
      setInvoiceSettings(settings)
      await openWindow()
      if (selectedRaffle) {
        const cache = await request(`/api/vendors/${user.id}/raffles/${selectedRaffle.id}/prepare-quota-cache`, { method: 'POST' })
        setUnavailableNumbers(cache.unavailableNumbers)
      }
      onSaleCompleted?.()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
      setIsProcessingPayment(false)
      paymentInFlightRef.current = false
    }
  }

  return (
    <section className="vendor-pos">
      {error && <div className="pos-toast" role="alert">{error}</div>}
      {isProcessingPayment && <div className="pos-payment-processing" role="status" aria-live="polite"><div className="pos-payment-spinner" /><strong>Procesando venta...</strong><span>No cierres esta ventana ni pulses pagar nuevamente.</span></div>}
      <div className="pos-unavailable-panel">
        <div className="pos-unavailable-heading"><strong>Numeros no disponibles</strong>{selectedRaffle && <span>{selectedRaffle.nombre}</span>}</div>
        <div className="pos-number-strip">
          {unavailableNumbers.map((number) => <span key={number} className="pos-unavailable-number">{number}<i /></span>)}
          {selectedRaffle && unavailableNumbers.length === 0 && <span className="pos-empty-numbers">No hay numeros bloqueados para esta rifa.</span>}
          {!selectedRaffle && <span className="pos-empty-numbers">Selecciona una rifa para consultar los numeros no disponibles.</span>}
        </div>
      </div>

      {isLoading && <p className="dashboard-message">Abriendo factura de venta...</p>}

      {!isLoading && invoice && <div className="pos-grid">
        <form className="pos-form" style={posTheme} onSubmit={handleAddToCart}>
          <div className="pos-form-title"><strong>Formulario</strong><span>Factura {invoice.numero_factura}</span></div>
          <label className="pos-date-field" onClick={openDatePicker}><span>Fecha</span><input ref={dateInputRef} name="saleDate" type="date" value={form.saleDate} onChange={handleChange} disabled={isSaving} required /></label>
          <label><span>Rifa</span><select name="raffleId" value={form.raffleId} onChange={handleChange} disabled={isSaving}><option value="">Selecciona una rifa</option>{rafflesForSelectedDate.map((raffle) => <option key={raffle.id} value={raffle.id}>{raffle.nombre}</option>)}</select></label>
          {rafflesForSelectedDate.length === 0 && <p className="pos-date-helper">No hay rifas disponibles para la fecha seleccionada.</p>}
          <label><span>Numero</span><input ref={numberInputRef} name="number" type="text" inputMode="numeric" pattern="[0-9]*" value={form.number} onChange={handleChange} onKeyDown={handleNumberKeyDown} placeholder="Ingresa numero" disabled={isSaving} /></label>
          <label><span>Valor</span><input name="value" type="number" min="0" step="0.01" value={form.value} onChange={handleChange} disabled={isSaving} /></label>
          <div className="pos-value-presets">{presetValues.map((value) => <button key={value} type="button" className={Number(form.value) === value ? 'active' : ''} onClick={() => setForm((currentForm) => ({ ...currentForm, value: String(value) }))}>{value.toFixed(2)}</button>)}</div>
          <label><span>Cantidad</span><input name="quantity" type="number" min="1" step="1" value={form.quantity} onChange={handleChange} disabled={isSaving} /></label>
          <button className="btn pos-add-button" type="submit" disabled={isSaving}>Agregar al carrito</button>
        </form>

        <div className="pos-cart">
          <div className="pos-cart-toolbar"><div><span>Factura: {invoice.numero_factura}</span><strong>Total: {formatMoney(invoice.total)}</strong></div><div><button className="btn pos-pay-button" type="button" disabled={isSaving || invoice.sales.length === 0} onClick={handlePay}>Pagar</button><button className="btn pos-clear-button" type="button" disabled={isSaving} onClick={handleClear}>Limpiar</button></div></div>
          <div className="pos-cart-table-wrap"><table className="pos-cart-table"><thead><tr><th>ID</th><th>Fecha</th><th>Tipo</th><th>Numero</th><th>Cantidad</th><th>Valor</th><th>Total</th><th aria-label="Acciones" /></tr></thead><tbody>{invoice.sales.map((sale) => {
            const raffleForSale = raffles.find((raffle) => raffle.id === sale.id_rifa)
            const raffleType = raffleTypes.find((type) => type.id === raffleForSale?.id_tipo)
            return <tr key={sale.id}><td>{sale.id}</td><td>{new Date(sale.created_at).toLocaleDateString('es-CO')}</td><td>{raffleType?.nombre || 'Sin tipo'}</td><td>{sale.numero}</td><td>{sale.cantidad}</td><td>{formatMoney(sale.valor)}</td><td>{formatMoney(sale.valor * sale.cantidad)}</td><td><button className="btn btn-danger" type="button" disabled={isSaving} onClick={() => handleRemoveSale(sale)}>Eliminar</button></td></tr>
          })}{invoice.sales.length === 0 && <tr><td colSpan="8" className="pos-cart-empty">Sin items en el carrito</td></tr>}</tbody></table></div>
        </div>
      </div>}
      {printedInvoice && <InvoiceReceiptModal key={`${printedInvoice.id}-${invoiceSettings?.modelo_factura || 'clasica'}`} invoice={printedInvoice} settings={invoiceSettings} onClose={() => setPrintedInvoice(null)} isOriginal />}
    </section>
  )
}

export default VendorPointOfSale