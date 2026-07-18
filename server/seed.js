const { getAllProducts, createProduct } = require("./db");

const SEED = [
  {
    name: "Ухаалаг цаг Pro X",
    price: 289000,
    category: "электроник",
    stock: 24,
    description:
      "Pro X ухаалаг цаг нь өдөр тутмын эрүүл мэнд, спортын хяналтад зориулагдсан. Зүрхний хэмнэл, хүчилтөрөгчийн хэмжилт, 50м усны хамгаалалттай. Батерей 7 хүртэл хоног ажиллана.",
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
      "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80",
      "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&q=80"
    ]
  },
  {
    name: "Чихэвч AirSound",
    price: 159000,
    category: "электроник",
    stock: 40,
    description:
      "AirSound чихэвч нь ANC технологиор гадаад дуу чимээг бууруулж, цэвэрхэн дуу гаргана. Цэнэглэх хайрцагтайгаа нийлээд 30 цаг ажиллана.",
    images: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80",
      "https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=800&q=80"
    ]
  },
  {
    name: "Арьсан цүнх Classic",
    price: 219000,
    category: "хувцас",
    stock: 15,
    description:
      "Classic арьсан цүнх нь бат бөх материал, цэвэрхэн загвараараа ялгарна. Зөөврийн компьютер, бичиг баримт зэрэгт зориулсан олон тасалгаатай.",
    images: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80",
      "https://images.unsplash.com/photo-1590874103328-eac38a67437a?w=800&q=80"
    ]
  },
  {
    name: "Гүйлтийн гутал Velocity",
    price: 189000,
    category: "спорт",
    stock: 32,
    description:
      "Velocity гутал нь урт гүйлтэнд зориулсан зөөлөн ул, амьсгалдаг дээд материалтай. Өдөр тутмын алхалт, спортын дасгалд тохиромжтой.",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
      "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=80"
    ]
  },
  {
    name: "Кофе машин Barista",
    price: 459000,
    category: "гэр ахуй",
    stock: 8,
    description:
      "Barista кофе машин нь гэртээ кафе шиг амттай кофе хийхэд тусална. Даралтын систем, сүү хөөсрүүлэгч, хялбар цэвэрлэгээтэй.",
    images: [
      "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&q=80",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80"
    ]
  },
  {
    name: "Зөөврийн цэнэглэгч 20000mAh",
    price: 79000,
    category: "электроник",
    stock: 60,
    description:
      "20000mAh багтаамжтай, PD хурдан цэнэглэлттэй повербанк. Утас, таблет, чихэвч зэрэг олон төхөөрөмжийг зэрэг цэнэглэнэ.",
    images: [
      "https://images.unsplash.com/photo-1609091839311-b48b1dd5020d?w=800&q=80"
    ]
  },
  {
    name: "Хөвөн цамц Essential",
    price: 49000,
    category: "хувцас",
    stock: 70,
    description:
      "Essential цамц нь өндөр чанарын хөвөн материалаар хийгдсэн. Зөөлөн, амьсгалдаг, олон өнгөний сонголттой.",
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80"
    ]
  },
  {
    name: "Bluetooth чанга яригч Boom",
    price: 129000,
    category: "электроник",
    stock: 22,
    description:
      "Boom чанга яригч нь IPX7 усны хамгаалалттай, 360° дуугаралттай. Аялал, гэрийн үдэшлэгт тохиромжтой.",
    images: [
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80"
    ]
  }
];

async function seed() {
  const existing = await getAllProducts();
  if (existing.length > 0) {
    console.log(`Firebase already has ${existing.length} products. Skip seed.`);
    return;
  }

  for (const item of SEED) {
    await createProduct(item);
  }

  console.log(`Seeded ${SEED.length} products to Firebase.`);
}

module.exports = { seed };
