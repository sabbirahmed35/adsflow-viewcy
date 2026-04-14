import { PrismaClient, UserRole, AdStatus, CampaignObjective, BudgetType, CtaType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 12);
  const clientPassword = await bcrypt.hash('client123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@adflow.io' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@adflow.io',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const client1 = await prisma.user.upsert({
    where: { email: 'jane@techlaunch.io' },
    update: {},
    create: {
      name: 'Jane Cooper',
      email: 'jane@techlaunch.io',
      passwordHash: clientPassword,
      role: UserRole.CLIENT,
    },
  });

  const client2 = await prisma.user.upsert({
    where: { email: 'marcus@shopnova.co' },
    update: {},
    create: {
      name: 'Marcus Rivera',
      email: 'marcus@shopnova.co',
      passwordHash: clientPassword,
      role: UserRole.CLIENT,
    },
  });

  console.log('✅ Users created:', { admin: admin.email, client1: client1.email, client2: client2.email });

  // Create ads for client1
  const ad1 = await prisma.ad.create({
    data: {
      userId: client1.id,
      status: AdStatus.PUBLISHED,
      websiteUrl: 'https://techlaunch.io/summit-2025',
      primaryText: "The biggest tech event of 2025 is here. Connect with 500+ innovators, hear from world-class speakers, and discover the tools shaping tomorrow. Early bird tickets are almost gone.",
      headline: 'Join the Future of Tech',
      description: '500+ speakers · 3 days · San Francisco',
      cta: CtaType.LEARN_MORE,
      creativeUrl: 'https://placehold.co/1080x1080/0066CC/white?text=Tech+Summit+2025',
      creativeType: 'IMAGE',
      objective: CampaignObjective.TRAFFIC,
      budgetType: BudgetType.DAILY,
      budgetAmount: 25,
      startDate: new Date('2025-01-10'),
      endDate: new Date('2025-03-01'),
      locations: ['United States', 'Canada'],
      ageMin: 25,
      ageMax: 45,
      interests: ['Technology', 'Business', 'Startups', 'Innovation'],
      placements: ['AUTOMATIC'],
      metaCampaignId: 'act_123456789_c1',
      metaAdSetId: 'act_123456789_as1',
      metaAdId: 'act_123456789_a1',
      reviewedById: admin.id,
      reviewedAt: new Date('2025-01-09'),
    },
  });

  const ad2 = await prisma.ad.create({
    data: {
      userId: client1.id,
      status: AdStatus.PENDING,
      websiteUrl: 'https://techlaunch.io/workshop',
      primaryText: "Level up your skills at our hands-on AI workshop. Learn to build with LLMs, computer vision, and more. Expert instructors, small groups, real projects.",
      headline: 'Build Real AI Products in 2 Days',
      description: 'Hands-on · Expert instructors · Certificate',
      cta: CtaType.SIGN_UP,
      creativeUrl: 'https://placehold.co/1080x1080/6633CC/white?text=AI+Workshop',
      creativeType: 'IMAGE',
      objective: CampaignObjective.LEAD_GENERATION,
      budgetType: BudgetType.DAILY,
      budgetAmount: 40,
      locations: ['United States'],
      ageMin: 22,
      ageMax: 40,
      interests: ['Artificial Intelligence', 'Machine Learning', 'Technology'],
      placements: ['AUTOMATIC'],
    },
  });

  const ad3 = await prisma.ad.create({
    data: {
      userId: client2.id,
      status: AdStatus.PENDING,
      websiteUrl: 'https://shopnova.co/summer-sale',
      primaryText: "Summer's biggest sale is live! Get up to 60% off our entire summer collection. Free shipping on orders over $50. Limited time — shop before stock runs out.",
      headline: '60% Off Summer Collection',
      description: 'Limited time · Free shipping $50+',
      cta: CtaType.SHOP_NOW,
      creativeUrl: 'https://placehold.co/1080x1080/FF6633/white?text=Summer+Sale',
      creativeType: 'IMAGE',
      objective: CampaignObjective.SALES,
      budgetType: BudgetType.DAILY,
      budgetAmount: 50,
      locations: ['United States', 'Canada'],
      ageMin: 18,
      ageMax: 35,
      interests: ['Fashion', 'Shopping', 'Lifestyle'],
      placements: ['AUTOMATIC'],
    },
  });

  const ad4 = await prisma.ad.create({
    data: {
      userId: client2.id,
      status: AdStatus.PUBLISHED,
      websiteUrl: 'https://shopnova.co/winter',
      primaryText: "Cold weather, hot styles. Our new winter collection just dropped — featuring premium materials and timeless designs. Free shipping on orders over $60.",
      headline: 'New Winter Collection Just Dropped',
      description: 'Premium quality · Free shipping $60+',
      cta: CtaType.SHOP_NOW,
      creativeUrl: 'https://placehold.co/1080x1080/336699/white?text=Winter+Collection',
      creativeType: 'IMAGE',
      objective: CampaignObjective.SALES,
      budgetType: BudgetType.DAILY,
      budgetAmount: 40,
      locations: ['United States', 'Canada', 'United Kingdom'],
      ageMin: 18,
      ageMax: 35,
      interests: ['Fashion', 'Lifestyle', 'Shopping'],
      placements: ['FACEBOOK_FEED', 'INSTAGRAM_FEED'],
      metaCampaignId: 'act_123456789_c2',
      metaAdSetId: 'act_123456789_as2',
      metaAdId: 'act_123456789_a2',
      reviewedById: admin.id,
      reviewedAt: new Date('2024-12-01'),
    },
  });

  const ad5 = await prisma.ad.create({
    data: {
      userId: client1.id,
      status: AdStatus.REJECTED,
      websiteUrl: 'https://techlaunch.io/course',
      primaryText: "Master digital marketing in 30 days. Expert-led curriculum, real-world projects, and a certificate upon completion. Only $149 — enroll today.",
      headline: 'Master Digital Marketing in 30 Days',
      description: '40+ hrs · Certificate · $149',
      cta: CtaType.GET_OFFER,
      creativeUrl: null,
      objective: CampaignObjective.LEAD_GENERATION,
      budgetType: BudgetType.DAILY,
      budgetAmount: 35,
      locations: ['United States', 'United Kingdom'],
      ageMin: 22,
      ageMax: 40,
      interests: ['Marketing', 'Business', 'Education'],
      placements: ['AUTOMATIC'],
      rejectionReason: 'No creative uploaded. Please provide a high-quality image (minimum 1080x1080px) before resubmitting.',
      reviewedById: admin.id,
      reviewedAt: new Date('2025-01-05'),
    },
  });

  const ad6 = await prisma.ad.create({
    data: {
      userId: client1.id,
      status: AdStatus.DRAFT,
      websiteUrl: 'https://techlaunch.io/pro-tools',
      primaryText: '',
      headline: '',
      description: '',
      cta: CtaType.LEARN_MORE,
      objective: CampaignObjective.TRAFFIC,
      budgetType: BudgetType.DAILY,
      budgetAmount: 20,
      locations: ['United States'],
      ageMin: 25,
      ageMax: 45,
      interests: [],
      placements: ['AUTOMATIC'],
    },
  });

  console.log('✅ Ads created:', { ad1: ad1.id, ad2: ad2.id, ad3: ad3.id, ad4: ad4.id });

  // Add performance data for published ads
  const today = new Date();
  const perfData = [];

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    perfData.push({
      adId: ad1.id,
      date,
      impressions: Math.floor(Math.random() * 2000) + 1000,
      clicks: Math.floor(Math.random() * 100) + 40,
      spend: parseFloat((Math.random() * 15 + 15).toFixed(2)),
      conversions: Math.floor(Math.random() * 10) + 2,
      reach: Math.floor(Math.random() * 1800) + 900,
      frequency: parseFloat((Math.random() * 0.5 + 1.0).toFixed(2)),
    });

    perfData.push({
      adId: ad4.id,
      date,
      impressions: Math.floor(Math.random() * 3000) + 1500,
      clicks: Math.floor(Math.random() * 150) + 60,
      spend: parseFloat((Math.random() * 20 + 22).toFixed(2)),
      conversions: Math.floor(Math.random() * 15) + 5,
      reach: Math.floor(Math.random() * 2500) + 1200,
      frequency: parseFloat((Math.random() * 0.6 + 1.1).toFixed(2)),
    });
  }

  for (const perf of perfData) {
    const ctr = perf.impressions > 0 ? (perf.clicks / perf.impressions) * 100 : 0;
    const cpc = perf.clicks > 0 ? perf.spend / perf.clicks : 0;
    const cpm = perf.impressions > 0 ? (perf.spend / perf.impressions) * 1000 : 0;

    await prisma.adPerformance.create({
      data: {
        ...perf,
        ctr: parseFloat(ctr.toFixed(4)),
        cpc: parseFloat(cpc.toFixed(4)),
        cpm: parseFloat(cpm.toFixed(4)),
      },
    });
  }

  console.log('✅ Performance data created for', perfData.length, 'records');
  console.log('\n🎉 Seed complete!\n');
  console.log('Test credentials:');
  console.log('  Admin:  admin@adflow.io / admin123');
  console.log('  Client: jane@techlaunch.io / client123');
  console.log('  Client: marcus@shopnova.co / client123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
