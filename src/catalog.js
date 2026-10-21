// Doors, prices and specifications of the Almaz factory (almaz-nsk.com, October 2026).
// Every price is the site's retail price («Розничная цена»): the same for both sizes and both handings.
// Characteristics are copied from the «Характеристики» tab of each product page; the look of the leaf
// (panel pattern, hardware layout) follows the product photos of the same pages.

export const COMPANY = {
  name: 'АЛМАЗ',
  full: 'Завод входных дверей «Алмаз»',
  site: 'https://almaz-nsk.com',
  city: 'Новосибирск, ул. Богдана Хмельницкого, зд. 144',
  phone: '+7 (383) 362-17-19',
  phoneHref: 'tel:+73833621719',
  free: '8-800-333-53-05',
  freeHref: 'tel:88003335305',
  telegram: 'https://t.me/almaz_nsk_dveri',
  email: 'shop@almaz54.ru',
};

const SITE = 'https://almaz-nsk.com/catalog/vkhodnye-dveri/';
const SIZES = [
  [880, 2050],
  [960, 2050],
];

/**
 * look: drives the 3D model (src/models/door.js + panels.js).
 *   frame / leaf: powder coats (frame «короб», leaf edges & steel skin), depth = frame depth (m).
 *   hw: hardware finish, ext / int: panel design ids (panels.js).
 */
export const DOORS = {
  kassiopeya: {
    id: 'kassiopeya',
    name: 'КАССИОПЕЯ стандарт',
    short: 'Кассиопея',
    collection: 'Diamante Porta',
    kind: 'Квартира и дом',
    url: SITE + 'kassiopeya-standart-kassiopeya-standart/',
    price: 58700,
    sizes: SIZES,
    tagline:
      'Комбинированные МДФ-панели с рисунком № 278: фигурная граница между отделками повторяет естественный край древесного среза. Сталь 1,5 мм, два замка KALE.',
    specs: {
      steel: '1,5 мм',
      box: '135 мм',
      leaf: '100 мм',
      contours: '3 контура',
      weight: null,
      locks: 'KALE 252 + KALE 257',
    },
    details: [
      ['Внешняя отделка', 'Трёхслойное полимерное покрытие «Муар чёрный» + МДФ щит сборный 10 мм № 278: 665 (рыжий) и 829 (чёрный) / Чёрный кварц + МДФ наличники'],
      ['Внутренняя отделка', 'МДФ щит сборный 16 мм № 278: 665 (рыжий) и 829 (чёрный) / Супермат латте'],
      ['Утеплитель', 'Минеральная плита высокой плотности'],
      ['Уплотнитель', 'Магнитный по всему периметру полотна и короба, тройной контур'],
      ['Основной замок', 'КАЛЕ 252 (сувальдный)'],
      ['Доп. замок', 'КАЛЕ 257 (цилиндровый)'],
      ['Фурнитура', 'Цилиндр ключ-поворотник, броненакладка прямоугольная, декоративная накладка на сувальдный замок, регулятор прижима, ночная задвижка. Цвет — чёрный'],
    ],
    look: {
      frame: { color: '#1b1c1e', texture: 'muar' },
      leaf: { color: '#1b1c1e', texture: 'muar' },
      depth: 0.135,
      thick: 0.1,
      hw: 'black',
      plate: 'rect',
      ext: 'kassiopeya_ext',
      int: 'kassiopeya_int',
      contours: 3,
      peephole: true,
    },
  },
  dino: {
    id: 'dino',
    name: 'ДИНО 10 ТЕРМО',
    short: 'Дино 10 Термо',
    collection: 'Diamante Porta · Термо',
    kind: 'Частный дом, улица',
    url: SITE + 'diamante-porta/dino-10-termo-dino-10-termo/',
    price: 147400,
    sizes: SIZES,
    tagline:
      'Классическая входная группа для частного дома: стеклопакет 42 мм с кованой защитной решёткой, фигурные наличники и капитель. Терморазрыв в полотне и коробе.',
    specs: {
      steel: '1,5 мм',
      box: '160 мм',
      leaf: '100 мм',
      contours: '2 контура',
      weight: null,
      locks: 'KALE 442 + KALE 447',
    },
    details: [
      ['Внешняя отделка', 'Трёхслойное полимерное покрытие «Жасмин муар металлик». Стеклопакет 42 мм, защитная решётка, фигурные наличники, капитель'],
      ['Внутренняя отделка', 'Трёхслойное полимерное покрытие RAL 9001 муар'],
      ['Утеплитель', 'Экструдированный пенополистирол, пенополистирол, изодом фольгированный, термовставка из стеклонаполненного полиамида по периметру терморазрыва полотна и короба'],
      ['Уплотнитель', 'Специализированный дверной по периметру короба и полотна, двойной контур'],
      ['Основной замок', 'КАЛЕ 442'],
      ['Доп. замок', 'КАЛЕ 447'],
      ['Фурнитура', 'Ночная задвижка, броненакладка и накладка Армадилло на цилиндр, раздельная ручка Армадилло, ручка-скоба Армадилло. Цвет — античное серебро'],
    ],
    look: {
      frame: { color: '#e6dcc6', texture: 'muar', metallic: true },
      leaf: { color: '#e6dcc6', texture: 'muar', metallic: true },
      inner: { color: '#e9e2cf', texture: 'muar' }, // RAL 9001
      depth: 0.16,
      thick: 0.1,
      hw: 'antique',
      plate: 'round',
      ext: 'dino_ext',
      int: 'dino_int',
      contours: 2,
      thermo: true,
      glass: true,
      peephole: false,
      lever: 'classic',
    },
  },
  berill: {
    id: 'berill',
    name: 'БЕРИЛЛ КВАДРО-3',
    short: 'Берилл Квадро-3',
    collection: 'Коллекция «Алмаз»',
    kind: 'Квартира и дом',
    url: SITE + 'berill-kvadro-3/',
    price: 45500,
    sizes: SIZES,
    tagline:
      'Геометрия граней: фрезерованный орех «каньон коньяк» и рифлёный «софт чёрный» на внешней панели, зеркало с чёрными раскладками — внутри.',
    specs: {
      steel: '1,2 мм',
      box: '120 мм',
      leaf: '105 мм',
      contours: '3 контура',
      weight: '105 кг',
      locks: 'Гардиан 32.11 + 30.01',
    },
    details: [
      ['Внешняя отделка', 'МДФ щит 10 мм с филенчатым рисунком № 277: Софт чёрный + Орех каньон коньяк, МДФ наличники. Трёхслойное полимерное покрытие «Муар чёрный»'],
      ['Внутренняя отделка', 'МДФ щит 16 мм с филенчатым рисунком № 119, Дуб кантри горизонт (на фото сайта — с зеркалом)'],
      ['Утеплитель', 'Минеральная плита'],
      ['Уплотнитель', 'Специализированный дверной по периметру полотна и короба'],
      ['Основной замок', 'Гардиан 32.11 (цилиндровый + язычок)'],
      ['Доп. замок', 'Гардиан 30.01 (сувальдный)'],
      ['Фурнитура', 'Цилиндр ключ-поворотник, броненакладка, декоративная накладка на сувальдный замок, эксцентрик прижима, ночная задвижка. Цвет — чёрный'],
    ],
    look: {
      frame: { color: '#1b1c1e', texture: 'muar' },
      leaf: { color: '#1b1c1e', texture: 'muar' },
      depth: 0.12,
      thick: 0.105,
      hw: 'black',
      plate: 'square',
      ext: 'berill_ext',
      int: 'berill_int',
      contours: 3,
      peephole: true,
    },
  },
  oskar: {
    id: 'oskar',
    name: 'ОСКАР',
    short: 'Оскар',
    collection: 'Diamante Porta',
    kind: 'Квартира и дом',
    url: SITE + 'diamante-porta/oskar-oskar/',
    price: 53050,
    sizes: SIZES,
    tagline:
      'Мрамор «Торос»: чёрный снаружи с горизонтальными декоративными вставками, белый внутри — с зеркалом во всю высоту и чёрными молдингами.',
    specs: {
      steel: '1,5–1,8 мм',
      box: '120 мм',
      leaf: '100 мм',
      contours: '3 контура',
      weight: '110 кг',
      locks: 'Гардиан 30.15 + 32.01',
    },
    details: [
      ['Внешняя отделка', 'Трёхслойное полимерное покрытие «Металлик чёрный» + МДФ щит 10 мм с декоративными вставками (RAL 9005) № 185, Торос чёрный + МДФ наличники'],
      ['Внутренняя отделка', 'МДФ щит 16 мм с декоративной зеркальной вставкой + чёрный молдинг № 186, Торос бьянко'],
      ['Утеплитель', 'Минеральная плита высокой плотности'],
      ['Уплотнитель', 'Магнитный по всему периметру полотна и короба, тройной контур'],
      ['Основной замок', 'Гардиан 30.15'],
      ['Доп. замок', 'Гардиан 32.01'],
      ['Фурнитура', 'Цилиндр ключ-поворотник, ночная задвижка, броненакладка прямоугольная, декоративные накладки прямоугольные, эксцентрик, глазок. Цвет — чёрный'],
    ],
    look: {
      frame: { color: '#141517', texture: 'peel', metallic: true },
      leaf: { color: '#141517', texture: 'peel', metallic: true },
      depth: 0.12,
      thick: 0.1,
      hw: 'black',
      plate: 'rect',
      ext: 'oskar_ext',
      int: 'oskar_int',
      contours: 3,
      peephole: true,
    },
  },
  niko: {
    id: 'niko',
    name: 'НИКО',
    short: 'Нико',
    collection: 'Diamante Porta',
    kind: 'Квартира и дом',
    url: SITE + 'diamante-porta/niko-niko/',
    price: 45750,
    sizes: [
      [860, 2050],
      [960, 2050],
    ],
    tagline:
      'Минимализм: гладкий МДФ «Стоун грей» с чёрной вертикалью снаружи, белый «Рейгар» внутри. Порог из нержавейки, фурнитура — никель, без глазка.',
    specs: {
      steel: '1,5–1,8 мм',
      box: '135 мм',
      leaf: '100 мм',
      contours: '3 контура',
      weight: '120 кг',
      locks: 'KALE 252 + KALE 257',
    },
    details: [
      ['Внешняя отделка', 'Трёхслойное полимерное покрытие «Металлик чёрный» (без блёсток) + МДФ щит 16 мм гладкий, Стоун грей'],
      ['Внутренняя отделка', 'МДФ щит 16 мм гладкий, Рейгар'],
      ['Утеплитель', 'Минеральная плита высокой плотности'],
      ['Уплотнитель', 'Магнитный по всему периметру полотна и короба, тройной контур'],
      ['Основной замок', 'КАЛЕ 252'],
      ['Доп. замок', 'КАЛЕ 257'],
      ['Фурнитура', 'Цилиндр ключ-поворотник, ночная задвижка, броненакладка, ручка-скоба, эксцентрик, без глазка, порог из нержавейки. Цвет — никель'],
      ['Важно', 'Базовая комплектация неизменна, заявки принимаются только в стандартном варианте'],
    ],
    look: {
      frame: { color: '#151618', texture: 'peel', metallic: true },
      leaf: { color: '#151618', texture: 'peel', metallic: true },
      depth: 0.135,
      thick: 0.1,
      hw: 'nickel',
      plate: 'round',
      ext: 'niko_ext',
      int: 'niko_int',
      contours: 3,
      peephole: false,
      threshold: true,
    },
  },
};

export const ORDER = ['kassiopeya', 'dino', 'berill', 'oskar', 'niko'];

export const HANDING = [
  ['right', 'Правое', 'Петли справа, открывание на себя'],
  ['left', 'Левое', 'Петли слева, открывание на себя'],
];

export function fmt(n) {
  return (Math.round(n * 100) / 100).toLocaleString('ru-RU');
}

export const rub = (n) => n.toLocaleString('ru-RU').replace(/[  ,]/g, ' ') + ' ₽';
