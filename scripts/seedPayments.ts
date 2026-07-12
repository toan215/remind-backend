import mongoose from 'mongoose';
import 'dotenv/config';
import CreditPackage from '../src/models/creditPackage.model';
import SubscriptionPlan from '../src/models/subscriptionPlan.model';

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/remind');
  console.log('Connected to MongoDB.');

  const existingPackages = await CreditPackage.countDocuments();
  if (existingPackages === 0) {
    await CreditPackage.create([
      { name: '5 sessions', type: 'expert_sessions', quantity: 5, price: 500000 },
      { name: '10 sessions', type: 'expert_sessions', quantity: 10, price: 900000 },
    ]);
    console.log('Seeded credit packages.');
  } else {
    console.log('Credit packages already exist, skipping.');
  }

  const existingPlans = await SubscriptionPlan.countDocuments();
  if (existingPlans === 0) {
    await SubscriptionPlan.create([
      { name: 'Monthly', price: 199000, billingPeriod: 'monthly', includedExpertSessions: 1, aiChatLimitPerMonth: 100, expertSessionValue: 199000, platformFeeRate: 10 },
      { name: 'Yearly', price: 1990000, billingPeriod: 'yearly', includedExpertSessions: 12, aiChatLimitPerMonth: 1200, expertSessionValue: 165833, platformFeeRate: 10 },
    ]);
    console.log('Seeded subscription plans.');
  } else {
    console.log('Subscription plans already exist, skipping.');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
