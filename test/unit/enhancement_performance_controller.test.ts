import { describe, it, expect, vi } from 'vitest';
import { EnhancementPerformanceController } from '../../src/enhancement/EnhancementPerformanceController';

describe('EnhancementPerformanceController', () => {
  it('initializes with default tier and allows setting tier explicitly', () => {
    const controller = new EnhancementPerformanceController('ULTRA');
    expect(controller.getTier()).toBe('ULTRA');

    controller.setTier('HIGH');
    expect(controller.getTier()).toBe('HIGH');
  });

  it('records frame execution times and calculates average GPU latency', () => {
    const controller = new EnhancementPerformanceController('BALANCED');
    controller.recordFrame(5.0, null);
    controller.recordFrame(6.0, null);
    controller.recordFrame(7.0, null);

    expect(controller.getAverageGpuTime()).toBeCloseTo(6.0, 1);
  });

  it('downshifts tier automatically when consecutive GPU frame times exceed budget', () => {
    const controller = new EnhancementPerformanceController('ULTRA');

    let mockNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => mockNow);

    // Initial frame establishes lastFpsCalcTime
    controller.recordFrame(35.0, null);

    // Advance time and record frames for 1st evaluation window
    for (let i = 0; i < 30; i++) {
      controller.recordFrame(35.0, null);
    }
    mockNow += 1050;
    controller.recordFrame(35.0, null); // 1st evaluation window triggers

    // Advance time and record frames for 2nd evaluation window
    for (let i = 0; i < 30; i++) {
      controller.recordFrame(35.0, null);
    }
    mockNow += 1050;
    controller.recordFrame(35.0, null); // 2nd evaluation window triggers downshift to HIGH

    expect(controller.getTier()).toBe('HIGH');

    vi.restoreAllMocks();
  });

  it('evaluates frame-skip policy correctly: skips neural passes when under heavy load', () => {
    const controller = new EnhancementPerformanceController('BALANCED');

    // Feed heavy frame times (> 14ms)
    for (let i = 0; i < 10; i++) {
      controller.recordFrame(15.5, null);
    }

    // Should alternate execution
    const pass1 = controller.shouldExecuteFullNeuralPass();
    const pass2 = controller.shouldExecuteFullNeuralPass();
    expect(pass1 !== pass2).toBe(true);
  });

  it('never executes heavy neural pass when tier is PERFORMANCE', () => {
    const controller = new EnhancementPerformanceController('PERFORMANCE');
    expect(controller.shouldExecuteFullNeuralPass()).toBe(false);
  });
});
