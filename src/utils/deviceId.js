const DEVICE_ID_KEY = "cadence_device_id";

export function generateDeviceId() {
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);

  if (!id) {
    id = generateDeviceId();
  }

  return id;
}

export default getDeviceId;
