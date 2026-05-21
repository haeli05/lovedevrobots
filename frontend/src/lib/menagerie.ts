export interface MenagerieRobot {
  id: string;          // directory name in mujoco_menagerie repo
  name: string;
  maker: string;
  category: 'arm' | 'bimanual' | 'humanoid' | 'quadruped' | 'hand' | 'other';
  dof: number;
  description: string;
  sceneFile?: string;  // defaults to 'scene.xml'
}

export const MENAGERIE_BASE =
  'https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main';

export const ROBOTS: MenagerieRobot[] = [
  // ── Arms ────────────────────────────────────────────────────────────────────
  {
    id: 'trs_so_arm100',
    name: 'SO-ARM100',
    maker: 'TheRobotStudio',
    category: 'arm',
    dof: 6,
    description: 'Low-cost 6-DOF arm. Feetech STS3215 servos. LeRobot compatible.',
  },
  {
    id: 'low_cost_robot_arm',
    name: 'Koch v1.1',
    maker: 'Alexander Koch',
    category: 'arm',
    dof: 6,
    description: 'Open-source budget arm. ~$250 BOM. Used in LeRobot research.',
  },
  {
    id: 'robotstudio_so101',
    name: 'SO-101',
    maker: 'TheRobotStudio',
    category: 'arm',
    dof: 6,
    description: 'Updated SO-ARM100 with improved wrist and gripper.',
  },
  {
    id: 'franka_emika_panda',
    name: 'Panda',
    maker: 'Franka Emika',
    category: 'arm',
    dof: 7,
    description: 'Industry-standard research arm. 7-DOF. ~$10k.',
  },
  {
    id: 'franka_fr3',
    name: 'FR3',
    maker: 'Franka Robotics',
    category: 'arm',
    dof: 7,
    description: 'Next-gen Panda. Faster, stiffer, research & production.',
  },
  {
    id: 'kuka_iiwa_14',
    name: 'iiwa 14',
    maker: 'KUKA',
    category: 'arm',
    dof: 7,
    description: 'Collaborative 7-DOF arm. 14 kg payload. Torque sensing.',
  },
  {
    id: 'universal_robots_ur5e',
    name: 'UR5e',
    maker: 'Universal Robots',
    category: 'arm',
    dof: 6,
    description: '5 kg payload collaborative arm. Widely deployed in industry.',
  },
  {
    id: 'trossen_vx300s',
    name: 'ViperX 300',
    maker: 'Trossen Robotics',
    category: 'arm',
    dof: 6,
    description: 'Dynamixel-based 6-DOF research arm. ROS ready.',
  },
  {
    id: 'flexiv_rizon4',
    name: 'Rizon 4',
    maker: 'Flexiv',
    category: 'arm',
    dof: 7,
    description: 'Adaptive robot with force/torque sensing. 4 kg payload.',
  },
  {
    id: 'kinova_gen3',
    name: 'Gen3',
    maker: 'Kinova',
    category: 'arm',
    dof: 7,
    description: 'Lightweight 7-DOF arm. 4 kg payload. Vision-ready.',
  },
  {
    id: 'rethink_robotics_sawyer',
    name: 'Sawyer',
    maker: 'Rethink Robotics',
    category: 'arm',
    dof: 7,
    description: '7-DOF collaborative arm with embedded vision.',
  },
  // ── Bimanual ─────────────────────────────────────────────────────────────────
  {
    id: 'aloha',
    name: 'ALOHA',
    maker: 'Google DeepMind',
    category: 'bimanual',
    dof: 14,
    description: 'Bimanual teleoperation system. 2× ViperX 300. ACT paper.',
  },
  // ── Humanoids ────────────────────────────────────────────────────────────────
  {
    id: 'unitree_h1',
    name: 'H1',
    maker: 'Unitree',
    category: 'humanoid',
    dof: 19,
    description: 'Full-size humanoid. 47 kg. 1.8 m/s walking.',
  },
  {
    id: 'unitree_g1',
    name: 'G1',
    maker: 'Unitree',
    category: 'humanoid',
    dof: 23,
    description: 'Compact humanoid with dexterous hands. ~$16k.',
  },
  {
    id: 'booster_t1',
    name: 'T1',
    maker: 'Booster Robotics',
    category: 'humanoid',
    dof: 21,
    description: 'Research humanoid platform.',
  },
  // ── Quadrupeds ───────────────────────────────────────────────────────────────
  {
    id: 'unitree_go2',
    name: 'Go2',
    maker: 'Unitree',
    category: 'quadruped',
    dof: 12,
    description: 'Agile quadruped. 15 kg. ~$1600.',
  },
  {
    id: 'boston_dynamics_spot',
    name: 'Spot',
    maker: 'Boston Dynamics',
    category: 'quadruped',
    dof: 12,
    description: 'Industry-leading quadruped. Payload arm available.',
  },
  {
    id: 'unitree_a1',
    name: 'A1',
    maker: 'Unitree',
    category: 'quadruped',
    dof: 12,
    description: 'Compact research quadruped. Popular in RL research.',
  },
  {
    id: 'google_barkour_vb',
    name: 'Barkour vB',
    maker: 'Google',
    category: 'quadruped',
    dof: 12,
    description: 'Google\'s agility-focused quadruped research platform.',
  },
  // ── Hands / Grippers ─────────────────────────────────────────────────────────
  {
    id: 'robotiq_2f85',
    name: '2F-85',
    maker: 'Robotiq',
    category: 'hand',
    dof: 1,
    description: 'Industry standard 2-finger adaptive gripper. 85mm stroke.',
  },
  {
    id: 'wonik_allegro',
    name: 'Allegro Hand',
    maker: 'Wonik Robotics',
    category: 'hand',
    dof: 16,
    description: '4-finger dexterous hand. 16 DOF. Research platform.',
  },
];

export const CATEGORY_LABELS: Record<MenagerieRobot['category'], string> = {
  arm:       'Arms',
  bimanual:  'Bimanual',
  humanoid:  'Humanoids',
  quadruped: 'Quadrupeds',
  hand:      'Hands & Grippers',
  other:     'Other',
};

export function getRobot(id: string): MenagerieRobot | undefined {
  return ROBOTS.find((r) => r.id === id);
}
