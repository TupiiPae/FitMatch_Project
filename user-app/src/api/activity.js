// user-app/src/api/activity.js
import api from "../lib/api";

export const getDailyActivity = (date) =>
  api.get("/activity/day", { params: { date } });

export const setDailySteps = ({ date, steps }) =>
  api.post("/activity/steps", { date, steps });

export const setDailyWeight = ({ date, weightKg }) =>
  api.post("/activity/weight", { date, weightKg });

export const saveDailyWorkouts = ({ date, workoutIds }) =>
  api.post("/activity/workouts", { date, workoutIds });

export const toggleWorkoutDone = ({ date, workoutId }) =>
  api.post("/activity/toggle-workout", { date, workoutId });

export const getWeightHistory = (limit = 10) =>
  api.get("/activity/weight-history", { params: { limit } });
