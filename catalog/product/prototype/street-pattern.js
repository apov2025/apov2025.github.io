// A label-free, rotated crop of a real street network. Data is local and ODbL.
export function drawStreetPattern(data, baseColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1792;
  const context = canvas.getContext('2d');
  context.fillStyle = baseColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const channels = [1, 3, 5].map(i => parseInt(baseColor.slice(i, i + 2), 16));
  const light = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > 145;
  const [west, south, east, north] = data.bounds;
  const weights = { residential: .8, unclassified: .8, tertiary: 1.3, secondary: 1.9, primary: 2.7 };
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(-.39);
  context.lineCap = 'round'; context.lineJoin = 'round';
  for (const kind of Object.keys(weights)) {
    context.strokeStyle = light ? (kind === 'primary' ? '#715d4a' : '#717b72') : (kind === 'primary' ? '#dfbc85' : '#d9ded0');
    context.globalAlpha = kind === 'primary' ? .65 : .36;
    context.lineWidth = weights[kind];
    context.beginPath();
    for (const road of data.roads) {
      if (road.kind !== kind) continue;
      road.points.forEach(([longitude, latitude], index) => {
        const x = ((longitude - west) / (east - west) - .5) * 2200;
        const y = (.5 - (latitude - south) / (north - south)) * 2200;
        if (index) context.lineTo(x, y); else context.moveTo(x, y);
      });
    }
    context.stroke();
  }
  return canvas;
}
