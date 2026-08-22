ALTER TABLE cupos_area_rifa
ALTER COLUMN c_2digitos TYPE numeric(12,2) USING c_2digitos::numeric(12,2),
ALTER COLUMN c_3digitos TYPE numeric(12,2) USING c_3digitos::numeric(12,2),
ALTER COLUMN c_4digitos TYPE numeric(12,2) USING c_4digitos::numeric(12,2),
ALTER COLUMN c_5digitos TYPE numeric(12,2) USING c_5digitos::numeric(12,2);