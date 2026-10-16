import React from 'react';

const createMockIcon = (name: string) => {
  const Component = React.forwardRef<any, any>((props, ref) =>
    React.createElement('span', { ...props, 'data-icon': name, ref }, props.children)
  );
  Component.displayName = `LucideIcon(${name})`;
  return Component;
};

export const Heart = createMockIcon('Heart');
export const X = createMockIcon('X');
export const MessageCircle = createMockIcon('MessageCircle');
export const Search = createMockIcon('Search');
export const SlidersHorizontal = createMockIcon('SlidersHorizontal');
export const Settings = createMockIcon('Settings');
export const Shield = createMockIcon('Shield');
export const Flag = createMockIcon('Flag');
export const MoreHorizontal = createMockIcon('MoreHorizontal');
export const ArrowLeft = createMockIcon('ArrowLeft');
export const ChevronLeft = createMockIcon('ChevronLeft');
export const ChevronRight = createMockIcon('ChevronRight');
export const ChevronUp = createMockIcon('ChevronUp');
export const ChevronDown = createMockIcon('ChevronDown');
export const MapPin = createMockIcon('MapPin');
export const Calendar = createMockIcon('Calendar');
export const Camera = createMockIcon('Camera');
export const Edit3 = createMockIcon('Edit3');
export const Check = createMockIcon('Check');
export const Plus = createMockIcon('Plus');
export const Sparkles = createMockIcon('Sparkles');
export const Compass = createMockIcon('Compass');
export const Paperclip = createMockIcon('Paperclip');
export const Mic = createMockIcon('Mic');
export const CheckCircle2 = createMockIcon('CheckCircle2');
export const AlertCircle = createMockIcon('AlertCircle');
export const ThumbsUp = createMockIcon('ThumbsUp');
export const User = createMockIcon('User');
export const Bell = createMockIcon('Bell');
export const Lock = createMockIcon('Lock');
export const RotateCcw = createMockIcon('RotateCcw');
export const Share2 = createMockIcon('Share2');
export const AlertTriangle = createMockIcon('AlertTriangle');
export const Info = createMockIcon('Info');
export const Eye = createMockIcon('Eye');
export const EyeOff = createMockIcon('EyeOff');
export const Trash2 = createMockIcon('Trash2');
export const Send = createMockIcon('Send');
export const Star = createMockIcon('Star');
export const Phone = createMockIcon('Phone');
export const Video = createMockIcon('Video');
export const Volume2 = createMockIcon('Volume2');
export const Play = createMockIcon('Play');
export const Pause = createMockIcon('Pause');
export const Plane = createMockIcon('Plane');
export const Ticket = createMockIcon('Ticket');
export const Music = createMockIcon('Music');
export const Briefcase = createMockIcon('Briefcase');
export const GraduationCap = createMockIcon('GraduationCap');

export type LucideIcon = React.FC<any>;
