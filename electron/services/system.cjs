const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { IS_WIN, run, powershellJson } = require('../lib/run.cjs');

let previousCpu = null;

/** Aggregated CPU times, the base of the load percentage. */
function cpuSample() {
  const cpus = os.cpus();
  return cpus.map((cpu) => {
    const times = cpu.times;
    const idle = times.idle;
    const total = times.user + times.nice + times.sys + times.irq + idle;
    return { idle, total };
  });
}

/**
 * CPU load in percent, computed from the delta with the previous call so the
 * value describes the interval between two dashboard refreshes.
 */
function cpuLoad() {
  const sample = cpuSample();
  const previous = previousCpu;
  previousCpu = sample;
  if (!previous || previous.length !== sample.length) return { total: 0, perCore: sample.map(() => 0) };
  const perCore = sample.map((core, index) => {
    const idleDelta = core.idle - previous[index].idle;
    const totalDelta = core.total - previous[index].total;
    if (totalDelta <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((1 - idleDelta / totalDelta) * 100)));
  });
  const total = Math.round(perCore.reduce((sum, value) => sum + value, 0) / (perCore.length || 1));
  return { total, perCore };
}

async function gpus() {
  const nvidia = await run('nvidia-smi', [
    '--query-gpu=name,memory.total,memory.used,utilization.gpu,temperature.gpu',
    '--format=csv,noheader,nounits',
  ]).catch(() => ({ ok: false, stdout: '' }));
  if (nvidia.ok && nvidia.stdout.trim()) {
    return nvidia.stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const [name, memoryTotal, memoryUsed, load, temperature] = line.split(',').map((part) => part.trim());
        return {
          name,
          memoryTotal: Number(memoryTotal) * 1024 * 1024,
          memoryUsed: Number(memoryUsed) * 1024 * 1024,
          load: Number(load),
          temperature: Number(temperature),
        };
      });
  }
  if (IS_WIN) {
    const cards = await powershellJson(
      'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion',
    );
    return cards.map((card) => ({
      name: card.Name,
      memoryTotal: Number(card.AdapterRAM) || 0,
      memoryUsed: 0,
      load: null,
      temperature: null,
      driver: card.DriverVersion,
    }));
  }
  const lspci = await run('sh', ['-c', 'lspci | grep -i "vga\\|3d controller"']);
  if (!lspci.ok) return [];
  return lspci.stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({
      name: line.split(': ').slice(1).join(': ') || line,
      memoryTotal: 0,
      memoryUsed: 0,
      load: null,
      temperature: null,
    }));
}

async function disks() {
  if (IS_WIN) {
    const drives = await powershellJson(
      'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace,VolumeName',
    );
    return drives.map((drive) => {
      const total = Number(drive.Size) || 0;
      const free = Number(drive.FreeSpace) || 0;
      return {
        mount: drive.DeviceID,
        label: drive.VolumeName || drive.DeviceID,
        total,
        free,
        used: total - free,
        percent: total ? Math.round(((total - free) / total) * 100) : 0,
      };
    });
  }
  const df = await run('df', ['-kP', '-x', 'tmpfs', '-x', 'devtmpfs', '-x', 'squashfs']);
  if (!df.ok) return [];
  return df.stdout
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 6)
    .map((parts) => {
      const total = Number(parts[1]) * 1024;
      const used = Number(parts[2]) * 1024;
      const free = Number(parts[3]) * 1024;
      return {
        mount: parts[5],
        label: parts[0],
        total,
        used,
        free,
        percent: total ? Math.round((used / total) * 100) : 0,
      };
    });
}

async function battery() {
  if (IS_WIN) {
    const packs = await powershellJson(
      'Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining,BatteryStatus',
    );
    if (!packs.length) return null;
    return {
      percent: Number(packs[0].EstimatedChargeRemaining) || 0,
      charging: Number(packs[0].BatteryStatus) === 2,
    };
  }
  const base = '/sys/class/power_supply';
  try {
    const entries = await fsp.readdir(base);
    const pack = entries.find((entry) => entry.startsWith('BAT'));
    if (!pack) return null;
    const percent = Number(await fsp.readFile(path.join(base, pack, 'capacity'), 'utf8'));
    const status = (await fsp.readFile(path.join(base, pack, 'status'), 'utf8')).trim();
    return { percent, charging: status === 'Charging' };
  } catch {
    return null;
  }
}

async function memory() {
  const total = os.totalmem();
  let free = os.freemem();
  if (!IS_WIN) {
    // MemAvailable is the honest "free" on Linux, os.freemem() ignores cache.
    try {
      const meminfo = await fsp.readFile('/proc/meminfo', 'utf8');
      const available = /MemAvailable:\s+(\d+) kB/.exec(meminfo);
      if (available) free = Number(available[1]) * 1024;
    } catch {
      /* keep os.freemem() */
    }
  }
  const used = total - free;
  return { total, free, used, percent: total ? Math.round((used / total) * 100) : 0 };
}

async function processes(limit = 12) {
  if (IS_WIN) {
    const list = await powershellJson(
      `Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First ${limit} Id,ProcessName,WorkingSet64,CPU`,
    );
    return list.map((item) => ({
      pid: Number(item.Id),
      name: item.ProcessName,
      memory: Number(item.WorkingSet64) || 0,
      cpu: Math.round((Number(item.CPU) || 0) * 10) / 10,
    }));
  }
  const ps = await run('sh', ['-c', `ps -eo pid,comm,rss,pcpu --sort=-rss | head -n ${limit + 1}`]);
  if (!ps.ok) return [];
  return ps.stdout
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .map((parts) => ({
      pid: Number(parts[0]),
      name: parts[1],
      memory: Number(parts[2]) * 1024,
      cpu: Number(parts[3]),
    }));
}

async function temperatures() {
  if (IS_WIN) {
    const zones = await powershellJson(
      'Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature | Select-Object CurrentTemperature',
    );
    return zones
      .map((zone) => Math.round(Number(zone.CurrentTemperature) / 10 - 273.15))
      .filter((value) => Number.isFinite(value) && value > 0 && value < 120)
      .map((value, index) => ({ label: `Zone ${index + 1}`, celsius: value }));
  }
  try {
    const base = '/sys/class/thermal';
    const zones = (await fsp.readdir(base)).filter((entry) => entry.startsWith('thermal_zone'));
    const readings = [];
    for (const zone of zones.slice(0, 4)) {
      const raw = Number(await fsp.readFile(path.join(base, zone, 'temp'), 'utf8'));
      const type = (await fsp.readFile(path.join(base, zone, 'type'), 'utf8')).trim();
      const celsius = Math.round(raw / 1000);
      if (celsius > 0 && celsius < 120) readings.push({ label: type, celsius });
    }
    return readings;
  } catch {
    return [];
  }
}

/** Everything the dashboard gauges need, in a single IPC round trip. */
async function snapshot() {
  const [mem, gpuList, diskList, batteryPack, temps] = await Promise.all([
    memory(),
    gpus(),
    disks(),
    battery(),
    temperatures(),
  ]);
  const cpus = os.cpus();
  return {
    cpu: {
      model: cpus[0]?.model?.trim() ?? 'CPU',
      cores: cpus.length,
      speed: cpus[0]?.speed ?? 0,
      ...cpuLoad(),
    },
    memory: mem,
    gpus: gpuList,
    disks: diskList,
    battery: batteryPack,
    temperatures: temps,
    os: {
      platform: process.platform,
      release: os.release(),
      hostname: os.hostname(),
      user: os.userInfo().username,
      arch: os.arch(),
      uptime: os.uptime(),
    },
    time: Date.now(),
  };
}

/** Human readable report reused by the AI diagnosis and the Tools page. */
async function report() {
  const snap = await snapshot();
  const top = await processes(6);
  const heaviestDisk = [...snap.disks].sort((a, b) => b.percent - a.percent)[0];
  const problems = [];
  if (snap.memory.percent >= 85) problems.push('RAM saturee (>85%)');
  if (snap.cpu.total >= 85) problems.push('CPU a fond (>85%)');
  if (heaviestDisk && heaviestDisk.percent >= 90) problems.push(`Disque ${heaviestDisk.mount} presque plein`);
  if (snap.temperatures.some((entry) => entry.celsius >= 85)) problems.push('Temperature elevee (>85 C)');
  return { snapshot: snap, top, problems };
}

async function killProcess(pid) {
  if (IS_WIN) {
    const result = await run('taskkill', ['/PID', String(pid), '/T', '/F']);
    if (!result.ok) throw new Error(result.stderr.trim() || 'Impossible de fermer ce processus.');
    return true;
  }
  process.kill(Number(pid), 'SIGTERM');
  return true;
}

/** Closes every process whose name looks like `name` (fuzzy, case free). */
async function killByName(name) {
  const needle = String(name || '').toLowerCase().replace(/\.exe$/, '');
  if (!needle) throw new Error('Quel programme dois-je fermer ?');
  const list = await processes(200);
  const targets = list.filter((entry) => entry.name.toLowerCase().replace(/\.exe$/, '').includes(needle));
  if (!targets.length) return { closed: 0, name: needle };
  let closed = 0;
  for (const target of targets) {
    try {
      await killProcess(target.pid);
      closed += 1;
    } catch {
      /* already gone or protected */
    }
  }
  return { closed, name: targets[0].name };
}

function existsSync(target) {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

module.exports = {
  snapshot,
  report,
  processes,
  disks,
  memory,
  gpus,
  temperatures,
  killProcess,
  killByName,
  existsSync,
};
