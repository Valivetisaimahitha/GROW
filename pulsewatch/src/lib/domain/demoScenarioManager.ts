import { PrismaClient } from '@prisma/client';
import { DemoScenarioType } from './types';

export class DemoScenarioManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  public async getScenarioState(): Promise<{ scenario: DemoScenarioType; timeShiftMinutes: number }> {
    let state = await this.prisma.demoScenarioState.findUnique({ where: { id: 'global' } });
    if (!state) {
      state = await this.prisma.demoScenarioState.create({
        data: {
          id: 'global',
          currentScenario: 'NORMAL_NOISE',
          advancedTimeMinutes: 0,
        },
      });
    }
    return {
      scenario: state.currentScenario as DemoScenarioType,
      timeShiftMinutes: state.advancedTimeMinutes,
    };
  }

  public async setScenario(scenario: DemoScenarioType): Promise<{ scenario: DemoScenarioType; timeShiftMinutes: number }> {
    const state = await this.prisma.demoScenarioState.upsert({
      where: { id: 'global' },
      update: { currentScenario: scenario },
      create: { id: 'global', currentScenario: scenario, advancedTimeMinutes: 0 },
    });
    return {
      scenario: state.currentScenario as DemoScenarioType,
      timeShiftMinutes: state.advancedTimeMinutes,
    };
  }

  public async advanceTime(additionalMinutes: number): Promise<{ scenario: DemoScenarioType; timeShiftMinutes: number }> {
    const currentState = await this.getScenarioState();
    const newMinutes = currentState.timeShiftMinutes + additionalMinutes;

    const state = await this.prisma.demoScenarioState.update({
      where: { id: 'global' },
      data: { advancedTimeMinutes: newMinutes },
    });

    return {
      scenario: state.currentScenario as DemoScenarioType,
      timeShiftMinutes: state.advancedTimeMinutes,
    };
  }

  public async resetDemo(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userObservation.deleteMany({ where: { userId } }),
      this.prisma.changeEvent.deleteMany({ where: { userId } }),
      this.prisma.demoScenarioState.upsert({
        where: { id: 'global' },
        update: { currentScenario: 'NORMAL_NOISE', advancedTimeMinutes: 0 },
        create: { id: 'global', currentScenario: 'NORMAL_NOISE', advancedTimeMinutes: 0 },
      }),
    ]);
  }
}
