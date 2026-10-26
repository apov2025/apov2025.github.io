const HARMONIES = ['tonal', 'analogous', 'complementary', 'split complementary', 'triadic'];

export function hslToHex(hue, saturation, lightness) {
  const h = ((hue % 360) + 360) % 360;
  const amplitude = saturation * Math.min(lightness, 1 - lightness);
  const channel = n => {
    const k = (n + h / 30) % 12;
    const value = lightness - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function luminance(hex) {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Continuous hue sampling gives every surface the full spectrum. Relative hue
// offsets, restrained front saturation, and button contrast keep each look coherent.
export function generateHarmoniousLook({ random = Math.random, previousCaseColor } = {}) {
  const pick = choices => choices[Math.floor(random() * choices.length)];
  const between = (low, high) => low + random() * (high - low);
  const finish = pick(['glossy', 'matte']);
  const harmony = pick(HARMONIES);
  const hue = random() * 360;
  const direction = random() < 0.5 ? -1 : 1;
  const offsets = {
    tonal: [0, 0],
    analogous: [24 * direction, -30 * direction],
    complementary: [0, 180],
    'split complementary': [0, 150 * direction],
    triadic: [120 * direction, -120 * direction],
  }[harmony];
  const darkFront = random() < 0.65;
  const caseSaturation = between(0.22, 0.48);
  const caseLightness = darkFront ? between(0.42, 0.78) : between(0.18, 0.48);
  const frontSaturation = between(0.18, 0.36);
  const frontLightness = darkFront ? between(0.15, 0.25) : between(0.8, 0.9);
  const buttonSaturation = between(0.4, 0.68);
  const initialButtonLightness = darkFront ? between(0.62, 0.76) : between(0.27, 0.4);

  function colors(baseHue) {
    const caseColor = hslToHex(baseHue, caseSaturation, caseLightness);
    const frontColor = hslToHex(baseHue + offsets[0], frontSaturation, frontLightness);
    let lightness = initialButtonLightness;
    let buttonColor = hslToHex(baseHue + offsets[1], buttonSaturation, lightness);
    while (contrast(frontColor, buttonColor) < 3 && lightness > 0.08 && lightness < 0.92) {
      lightness = Math.max(0.08, Math.min(0.92, lightness + (darkFront ? 0.04 : -0.04)));
      buttonColor = hslToHex(baseHue + offsets[1], buttonSaturation, lightness);
    }
    return { caseColor, frontColor, buttonColor };
  }
  let palette = colors(hue);
  if (palette.caseColor === previousCaseColor) palette = colors(hue + 137.508);
  return { finish, harmony, ...palette };
}

// Restrained analogues and complements anchored to the actual M1 finishes.
export const KEYBOARD_PALETTES = Object.freeze({
 copper: ['#29464c','#475e51','#d6c6ae','#34424c','#a5b4ae'],
 graphite: ['#a9bcb0','#8ba9b2','#d2c9bc','#6c7e73','#535f68'],
 silver: ['#637d88','#b2bdc9','#8b849b','#454f5b','#b1bcae'],
});
export function generateDuoLook({random=Math.random,previousCaseColor}={}){
 const choices=Object.entries(KEYBOARD_PALETTES).flatMap(([keyboard,colors])=>colors.filter(c=>c!==previousCaseColor).map(caseColor=>({keyboard,caseColor})));
 const choice=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
 return {...choice,finish:random()<.5?'matte':'glossy'};
}
export function keyboardForColor(hex){
 const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));const a=rgb(hex);
 return Object.entries(KEYBOARD_PALETTES).flatMap(([keyboard,colors])=>colors.map(c=>({keyboard,d:rgb(c).reduce((sum,v,i)=>sum+(v-a[i])**2,0)}))).sort((a,b)=>a.d-b.d)[0].keyboard;
}
