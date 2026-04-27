let _blob = null;
let _volumeData = [];
export function storeAudio(blob, volumeData) {
  _blob = blob;
  _volumeData = volumeData;
}
export function getAudio() {
  return { blob: _blob, volumeData: _volumeData };
}
export function clearAudio() {
  _blob = null;
  _volumeData = [];
}
