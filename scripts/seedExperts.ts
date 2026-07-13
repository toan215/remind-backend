import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import User from '../src/models/user.model';
import ExpertSlot from '../src/models/expertSlot.model';

interface SeedExpert {
  email: string;
  password: string;
  fullName: string;
  title: string;
  specialties: string[];
  languages: string[];
  bio: string;
  slotPrices: number[];
}

const SEED_EXPERTS: SeedExpert[] = [
  {
    email: 'expert.nga@remind.test',
    password: 'expert123',
    fullName: 'TS. Nguyễn Thị Nga',
    title: 'Bác sĩ Tâm lý lâm sàng',
    specialties: ['Trầm cảm', 'Lo âu'],
    languages: ['Tiếng Việt'],
    bio: 'Bác sĩ với 10 năm kinh nghiệm trị liệu trầm cảm và rối loạn lo âu.',
    slotPrices: [400000, 500000],
  },
  {
    email: 'expert.minh@remind.test',
    password: 'expert123',
    fullName: 'ThS. Lê Văn Minh',
    title: 'Tư vấn viên Tâm lý',
    specialties: ['Stress công việc', 'Mối quan hệ'],
    languages: ['Tiếng Việt', 'Tiếng Anh'],
    bio: 'Chuyên gia tư vấn căng thẳng công việc và các mối quan hệ cá nhân.',
    slotPrices: [300000, 350000],
  },
  {
    email: 'expert.linh@remind.test',
    password: 'expert123',
    fullName: 'Dr. Phạm Thu Linh',
    title: 'Nhà trị liệu LGBTQ+',
    specialties: ['LGBTQ+', 'Lo âu'],
    languages: ['Tiếng Việt', 'Tiếng Anh'],
    bio: 'Đồng hành cùng cộng đồng LGBTQ+ và người gặp áp lực tâm lý.',
    slotPrices: [450000],
  },
];

function buildSlots(expertId: mongoose.Types.ObjectId, prices: number[]) {
  const slots = [];
  const now = new Date();
  // Next 5 days, 2 slots/day
  for (let day = 1; day <= 5; day++) {
    const base = new Date(now);
    base.setDate(base.getDate() + day);

    const morning = new Date(base);
    morning.setHours(9, 0, 0, 0);
    const morningEnd = new Date(morning);
    morningEnd.setHours(10, 0, 0, 0);

    const afternoon = new Date(base);
    afternoon.setHours(14, 0, 0, 0);
    const afternoonEnd = new Date(afternoon);
    afternoonEnd.setHours(15, 0, 0, 0);

    slots.push(
      { expertId, startAt: morning, endAt: morningEnd, price: prices[0], status: 'available' },
      { expertId, startAt: afternoon, endAt: afternoonEnd, price: prices[prices.length - 1], status: 'available' },
    );
  }
  return slots;
}

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/remind');
  console.log('Connected to MongoDB.');

  for (const e of SEED_EXPERTS) {
    const existing = await User.findOne({ email: e.email });
    if (existing) {
      console.log(`Skipping existing expert: ${e.fullName} (${e.email})`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(e.password, 12);
    const expert = await User.create({
      email: e.email,
      password: hashedPassword,
      fullName: e.fullName,
      role: 'expert',
      status: 'active',
      expert: {
        profile: {
          professionalTitle: e.title,
          bio: e.bio,
          specialties: e.specialties,
          languages: e.languages,
        },
        approval: { reviewedAt: new Date() },
      },
    });

    const slots = buildSlots(expert._id, e.slotPrices);
    await ExpertSlot.insertMany(slots);

    console.log(`Created expert: ${e.fullName}`);
    console.log(`  Email:    ${e.email}`);
    console.log(`  Password: ${e.password}`);
    console.log(`  ID:       ${expert._id}`);
    console.log(`  Slots:    ${slots.length} available`);
  }

  console.log('Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
