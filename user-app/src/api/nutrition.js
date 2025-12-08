import api from "../lib/api";

// Logs theo ngày
export const getDayLogs = (date) =>
  api.get("/nutrition/logs", { params: { date } });

export const deleteLog = (logId) =>
  api.delete(`/nutrition/logs/${logId}`);

// Streak (liên tục theo ngày hiện tại)
export const getStreak = () => api.get("/nutrition/streak");

// Nước
export const getWater = (date) =>
  api.get("/nutrition/water", { params: { date } });

export const incWater = ({ date, deltaMl }) =>
  api.post("/nutrition/water", { date, deltaMl });
