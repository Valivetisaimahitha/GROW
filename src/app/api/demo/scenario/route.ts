import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DemoScenarioManager } from '@/lib/domain/demoScenarioManager';
import { DemoScenarioType } from '@/lib/domain/types';
import { getAuthenticatedUser } from '@/lib/auth';

function checkDemoMode() {
  if (process.env.DEMO_MODE !== 'true') {
    throw new Error('DEMO_MODE_DISABLED');
  }
}

// GET /api/demo/scenario
export async function GET() {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: { code: 'DEMO_MODE_DISABLED', message: 'Demo endpoints disabled in production' } }, { status: 403 });
  }
  const manager = new DemoScenarioManager(prisma);
  const state = await manager.getScenarioState();
  return NextResponse.json({ success: true, data: state });
}

// POST /api/demo/scenario
export async function POST(req: NextRequest) {
  try {
    if (process.env.DEMO_MODE !== 'true') {
      return NextResponse.json({ error: { code: 'DEMO_MODE_DISABLED', message: 'Demo endpoints disabled in production' } }, { status: 403 });
    }

    const user = await getAuthenticatedUser(req);
    const body = await req.json();
    const { action, scenario, minutes } = body;
    const manager = new DemoScenarioManager(prisma);

    if (action === 'set_scenario') {
      const state = await manager.setScenario(scenario as DemoScenarioType);
      return NextResponse.json({ success: true, message: `Switched scenario to ${scenario}`, data: state });
    }

    if (action === 'advance_time') {
      const state = await manager.advanceTime(minutes || 15);
      return NextResponse.json({ success: true, message: `Advanced time by ${minutes || 15} minutes`, data: state });
    }

    if (action === 'reset_demo') {
      await manager.resetDemo(user.id);
      return NextResponse.json({ success: true, message: 'Demo reset successfully' });
    }

    return NextResponse.json({ error: { code: 'INVALID_ACTION', message: 'Unknown demo action' } }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: { code: 'DEMO_ACTION_FAILED', message: error.message || 'Demo action failed' } }, { status: 500 });
  }
}
