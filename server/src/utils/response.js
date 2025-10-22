export const ok = (res, data, message = 'OK') => res.json({ message, data });
export const fail = (res, code = 400, message = 'Bad Request') =>
  res.status(code).json({ message });


export function responseOk(extra = {}) {
  return { success: true, ...extra };
}
export function responseError(message = "Something went wrong", extra = {}) {
  return { success: false, message, ...extra };
}