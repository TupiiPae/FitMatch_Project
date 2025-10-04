export const ok = (res, data, message = 'OK') => res.json({ message, data });
export const fail = (res, code = 400, message = 'Bad Request') =>
  res.status(code).json({ message });
