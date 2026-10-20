import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import {
  Heart,
  X,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Settings,
  Shield,
  Flag,
  MoreHorizontal,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  MapPin,
  Calendar,
  Camera,
  Edit3,
  Check,
  Plus,
  Sparkles,
  Compass,
  Paperclip,
  Mic,
  CheckCircle2,
  AlertCircle,
  ThumbsUp,
  User,
  Bell,
  Lock,
  RotateCcw,
  Share,
  Share2,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Trash2,
  Send,
  Star,
  Phone,
  Video,
  Volume2,
  Play,
  Pause,
  Plane,
  Ticket,
  Music,
  Briefcase,
  GraduationCap,
  LogOut,
  Minus,
  Flame,
  Zap,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react-native';
import { useTheme } from '../theme/index.js';

export type IconName =
  | 'heart'
  | 'close'
  | 'message'
  | 'flame'
  | 'zap'
  | 'arrowUpRight'
  | 'search'
  | 'filter'
  | 'settings'
  | 'shield'
  | 'flag'
  | 'more'
  | 'back'
  | 'chevron'
  | 'location'
  | 'calendar'
  | 'camera'
  | 'edit'
  | 'check'
  | 'plus'
  | 'minus'
  | 'sparkles'
  | 'sparkle'
  | 'compass'
  | 'attachment'
  | 'mic'
  | 'checkCircle'
  | 'alertCircle'
  | 'thumbsUp'
  | 'user'
  | 'bell'
  | 'lock'
  | 'logout'
  | 'refresh'
  | 'share'
  | 'share2'
  | 'warning'
  | 'info'
  | 'eye'
  | 'eyeOff'
  | 'trash'
  | 'send'
  | 'star'
  | 'phone'
  | 'video'
  | 'volume'
  | 'play'
  | 'pause'
  | 'plane'
  | 'ticket'
  | 'music'
  | 'briefcase'
  | 'graduationCap';

export type IconSize = 'tiny' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize;
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly style?: ViewStyle;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly direction?: 'left' | 'right' | 'up' | 'down';
  readonly fill?: string;
}

const resolveSize = (size: IconSize): number => {
  if (typeof size === 'number') return size;
  switch (size) {
    case 'tiny':
      return 14;
    case 'xs':
      return 16;
    case 'sm':
      return 18;
    case 'md':
      return 24;
    case 'lg':
      return 32;
    case 'xl':
      return 40;
    default:
      return 24;
  }
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color,
  strokeWidth = 2,
  style,
  accessibilityLabel,
  testID,
  direction = 'right',
  fill,
}) => {
  const { colors } = useTheme();
  const iconColor = color || colors.textPrimary;
  const dimension = resolveSize(size);

  const getIconComponent = (): LucideIcon => {
    switch (name) {
      case 'heart':
        return Heart;
      case 'close':
        return X;
      case 'message':
        return MessageCircle;
      case 'search':
        return Search;
      case 'filter':
        return SlidersHorizontal;
      case 'settings':
        return Settings;
      case 'shield':
        return Shield;
      case 'flag':
        return Flag;
      case 'more':
        return MoreHorizontal;
      case 'back':
        return ArrowLeft;
      case 'chevron':
        switch (direction) {
          case 'left':
            return ChevronLeft;
          case 'up':
            return ChevronUp;
          case 'down':
            return ChevronDown;
          case 'right':
          default:
            return ChevronRight;
        }
      case 'location':
        return MapPin;
      case 'calendar':
        return Calendar;
      case 'camera':
        return Camera;
      case 'edit':
        return Edit3;
      case 'check':
        return Check;
      case 'plus':
        return Plus;
      case 'minus':
        return Minus;
      case 'sparkles':
      case 'sparkle':
        return Sparkles;
      case 'compass':
        return Compass;
      case 'attachment':
        return Paperclip;
      case 'mic':
        return Mic;
      case 'checkCircle':
        return CheckCircle2;
      case 'alertCircle':
        return AlertCircle;
      case 'thumbsUp':
        return ThumbsUp;
      case 'user':
        return User;
      case 'bell':
        return Bell;
      case 'lock':
        return Lock;
      case 'logout':
        return LogOut;
      case 'refresh':
        return RotateCcw;
      case 'share':
        return Share;
      case 'share2':
        return Share2;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
      case 'eye':
        return Eye;
      case 'eyeOff':
        return EyeOff;
      case 'trash':
        return Trash2;
      case 'send':
        return Send;
      case 'star':
        return Star;
      case 'phone':
        return Phone;
      case 'video':
        return Video;
      case 'volume':
        return Volume2;
      case 'play':
        return Play;
      case 'pause':
        return Pause;
      case 'plane':
        return Plane;
      case 'ticket':
        return Ticket;
      case 'music':
        return Music;
      case 'briefcase':
        return Briefcase;
      case 'graduationCap':
        return GraduationCap;
      case 'flame':
        return Flame;
      case 'zap':
        return Zap;
      case 'arrowUpRight':
        return ArrowUpRight;
      default:
        return Sparkles;
    }
  };

  const IconComponent = getIconComponent();

  return (
    <View
      style={[styles.container, { width: dimension, height: dimension }, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || name}
      testID={testID}
    >
      <IconComponent
        size={dimension}
        color={iconColor}
        strokeWidth={strokeWidth}
        fill={fill || (name === 'heart' && fill ? fill : 'none')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
