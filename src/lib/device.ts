/** Détection OS / navigateur / type d'appareil depuis le user-agent. */

export interface DeviceInfo {
  os: string;
  browser: string;
  device_type: string; // mobile | tablette | desktop
}

export function parseUserAgent(ua: string): DeviceInfo {
  let os = 'Autre';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS/i.test(ua)) os = 'Mac';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Autre';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  let device_type = 'desktop';
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    device_type = 'tablette';
  } else if (/iPhone|Android.*Mobile|Mobile|webOS/i.test(ua)) {
    device_type = 'mobile';
  }

  return { os, browser, device_type };
}

/**
 * Tags de contexte utilisés pour prioriser les articles RAG.
 * Ex. un article tagué « mac » remonte si l'OS détecté est Mac.
 */
export function contextTags(info: DeviceInfo): string[] {
  const tags: string[] = [];
  const push = (t?: string) => t && tags.push(t.toLowerCase());
  push(info.os);
  push(info.device_type);
  push(info.device_type === 'desktop' ? 'ordinateur' : undefined);
  push(info.browser);
  return tags;
}
