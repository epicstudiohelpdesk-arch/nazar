import React from 'react';

const createSvgComponent = (tag: string) => {
  return React.forwardRef<any, any>((props, ref) => React.createElement(tag, { ...props, ref }));
};

export const Svg = createSvgComponent('svg');
export const Path = createSvgComponent('path');
export const Circle = createSvgComponent('circle');
export const Rect = createSvgComponent('rect');
export const Line = createSvgComponent('line');
export const G = createSvgComponent('g');
export const Polyline = createSvgComponent('polyline');
export const Polygon = createSvgComponent('polygon');
export const Defs = createSvgComponent('defs');
export const Stop = createSvgComponent('stop');
export const LinearGradient = createSvgComponent('linearGradient');
export const RadialGradient = createSvgComponent('radialGradient');
export const Text = createSvgComponent('text');
export const TSpan = createSvgComponent('tspan');

export default Svg;
