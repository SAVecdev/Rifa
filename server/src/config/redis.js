// Deprecated: this project now uses Supabase as the main database.
// Kept only as a compatibility stub to avoid breaking older imports.
export const connectRedis = async () => {
  console.warn('Redis is no longer used in this project. Supabase is the database backend.')
  return null
}

export default null
