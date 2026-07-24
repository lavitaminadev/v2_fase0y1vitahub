import {
  FaCircleCheck,
  FaCircleXmark,
  FaPencil,
  FaTrash,
  FaGear,
  FaHouse,
  FaFileExport,
  FaBell,
  FaLock,
  FaLockOpen,
  FaChevronDown,
  FaChevronUp,
  FaSpinner,
  FaPlus,
  FaMinus,
  FaEye,
  FaEyeSlash,
  FaCheck,
  FaXmark,
  FaArrowRight,
  FaCopy,
  FaPause,
  FaPlay,
  FaDownload,
  FaCalendar,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapPin,
  FaLink,
  FaShield,
  FaCloudArrowUp,
  FaImage,
  FaCircleQuestion,
  FaBars,
  FaList,
  FaInbox,
  FaChartLine,
  FaBuilding,
} from 'react-icons/fa6';

export const VitaIcons = {
  success: FaCircleCheck,
  error: FaCircleXmark,
  edit: FaPencil,
  delete: FaTrash,
  settings: FaGear,
  home: FaHouse,
  export: FaFileExport,
  notification: FaBell,
  lock: FaLock,
  unlock: FaLockOpen,
  expand: FaChevronDown,
  collapse: FaChevronUp,
  loading: FaSpinner,
  add: FaPlus,
  remove: FaMinus,
  eye: FaEye,
  eyeSlash: FaEyeSlash,
  check: FaCheck,
  times: FaXmark,
  arrow: FaArrowRight,
  copy: FaCopy,
  pause: FaPause,
  play: FaPlay,
  download: FaDownload,
  calendar: FaCalendar,
  user: FaUser,
  envelope: FaEnvelope,
  phone: FaPhone,
  mapPin: FaMapPin,
  link: FaLink,
  gear: FaGear,
  shield: FaShield,
  upload: FaCloudArrowUp,
  image: FaImage,
  question: FaCircleQuestion,
  menu: FaBars,
  list: FaList,
  inbox: FaInbox,
  chart: FaChartLine,
  building: FaBuilding,
  close: FaXmark,
  cog: FaGear,
  users: FaUser,
};

export type VitaIconName = keyof typeof VitaIcons;

export function IconButton({
  icon: IconComponent,
  label,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  [key: string]: any;
}) {
  const sizeClass = {
    sm: 'icon-button-sm',
    md: 'icon-button-md',
    lg: 'icon-button-lg',
  }[size];

  const variantClass = {
    primary: 'icon-button-primary',
    outline: 'icon-button-outline',
    danger: 'icon-button-danger',
    ghost: 'icon-button-ghost',
  }[variant];

  return (
    <button
      {...props}
      className={`icon-button ${sizeClass} ${variantClass} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
    >
      <IconComponent className="icon-button-icon" />
      <span>{label}</span>
    </button>
  );
}

export function Icon({
  name,
  className = '',
  size = 'md',
  ...props
}: {
  name: VitaIconName;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  [key: string]: any;
}) {
  const IconComponent = VitaIcons[name];
  const sizeClass = {
    sm: 'icon-sm',
    md: 'icon-md',
    lg: 'icon-lg',
  }[size];

  return <IconComponent className={`icon ${sizeClass} ${className}`.trim()} {...props} />;
}
