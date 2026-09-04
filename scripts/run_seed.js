const { PrismaClient } = require('@prisma/client');

const DEFAULT_SECURITIES = [
  { symbol: 'INFY', companyName: 'Infosys Limited', volatility: 0.015, avgVol: 5000000 },
  { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', volatility: 0.018, avgVol: 8000000 },
  { symbol: 'TCS', companyName: 'Tata Consultancy Services', volatility: 0.012, avgVol: 3000000 },
  { symbol: 'HDFCBANK', companyName: 'HDFC Bank Limited', volatility: 0.014, avgVol: 9000000 },
  { symbol: 'ICICIBANK', companyName: 'ICICI Bank Limited', volatility: 0.016, avgVol: 7000000 },
  { symbol: 'TATAMOTORS', companyName: 'Tata Motors Limited', volatility: 0.025, avgVol: 12000000 },
  { symbol: 'WIPRO', companyName: 'Wipro Limited', volatility: 0.017, avgVol: 4000000 },
  { symbol: 'ITC', companyName: 'ITC Limited', volatility: 0.011, avgVol: 10000000 },
];

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding PulseWatch Security Master & Demo User...');

  // 1. Seed Security Master
  for (const sec of DEFAULT_SECURITIES) {
    await prisma.securityMaster.upsert({
      where: { symbol: sec.symbol },
      update: {
        companyName: sec.companyName,
        typicalVolatility: sec.volatility,
        averageVolume: sec.avgVol,
      },
      create: {
        symbol: sec.symbol,
        companyName: sec.companyName,
        exchange: 'NSE',
        currency: 'INR',
        typicalVolatility: sec.volatility,
        averageVolume: sec.avgVol,
        active: true,
      },
    });
  }

  // 2. Seed Default User & Watchlist
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@pulsewatch.local' },
    update: {},
    create: {
      id: 'demo_user_default',
      name: 'Demo Investor',
      email: 'demo@pulsewatch.local',
    },
  });

  const defaultWatchlist = await prisma.watchlist.upsert({
    where: { id: 'default_watchlist_id' },
    update: {},
    create: {
      id: 'default_watchlist_id',
      userId: demoUser.id,
      name: 'My Watchlist',
      isDefault: true,
    },
  });

  // 3. Seed Watchlist Items
  const sampleSymbols = ['INFY', 'RELIANCE', 'TCS', 'HDFCBANK', 'ICICIBANK', 'TATAMOTORS', 'WIPRO', 'ITC'];
  let idx = 1;
  for (const sym of sampleSymbols) {
    const sec = DEFAULT_SECURITIES.find(s => s.symbol === sym);
    await prisma.watchlistItem.upsert({
      where: {
        watchlistId_symbol: {
          watchlistId: defaultWatchlist.id,
          symbol: sym,
        },
      },
      update: {},
      create: {
        watchlistId: defaultWatchlist.id,
        symbol: sym,
        displayName: sec?.companyName || `${sym} Ltd`,
        sortOrder: idx++,
      },
    });
  }

  console.log('PulseWatch Seed Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
