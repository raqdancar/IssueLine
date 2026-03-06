export const errorHandler = (error, _req, res, _next) => {
  const status = error.status ?? 500
  const message = error.message ?? 'Unexpected error'
  res.status(status).json({ error: message })
}
