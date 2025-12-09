// utils/response.js

export const ok = (res, data, message = "OK") =>
  res.json({ message, data });

export const fail = (res, code = 400, message = "Bad Request") =>
  res.status(code).json({ message });

/**
 * Cách dùng 1: responseOk(res, { foo: 1 })
 *   => gửi JSON: { success: true, foo: 1 }
 *
 * Cách dùng 2: responseOk({ foo: 1 })
 *   => trả về object { success: true, foo: 1 }
 */
export function responseOk(resOrExtra = {}, extraIfRes = {}) {
  // Nếu tham số đầu tiên có .json (Express response) => kiểu dùng 1
  if (resOrExtra && typeof resOrExtra.json === "function") {
    const res = resOrExtra;
    const extra = extraIfRes || {};
    return res.json({ success: true, ...extra });
  }

  // Ngược lại => kiểu dùng 2 (thuần object)
  const extra = resOrExtra || {};
  return { success: true, ...extra };
}

/**
 * Giữ nguyên kiểu thuần object cho responseError
 * (nếu sau này muốn dùng với res thì mình có thể mở rộng giống responseOk)
 */
export function responseError(message = "Something went wrong", extra = {}) {
  return { success: false, message, ...extra };
}
