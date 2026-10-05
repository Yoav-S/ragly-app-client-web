const MORNING_HOUR = 5;
const EVENING_HOUR = 17;
const NIGHT_HOUR = 21;

export function greetingKey(now = new Date()): string {
  const hour = now.getHours();
  if (hour >= NIGHT_HOUR || hour < MORNING_HOUR) return "dashboard.greeting_night";
  if (hour >= EVENING_HOUR) return "dashboard.greeting_evening";
  return "dashboard.greeting_morning";
}
