export interface Supplier {
  name: string;
  region: string;
  price_usd: number;
  note: string;
  url: string;
}

export interface SupplierEntry {
  component: string;
  qty: number;
  suppliers: Supplier[];
}

// Supplier tables keyed by robot ID
export const ROBOT_SUPPLIERS: Record<string, SupplierEntry[]> = {
  trs_so_arm100: [
    {
      component: 'Feetech STS3215 Servo (×6)',
      qty: 6,
      suppliers: [
        { name: 'Feetech Direct (1688.com)', region: 'CN', price_usd: 48, note: '¥55/ea · slow ship · cheapest', url: 'https://www.1688.com/product/835601041.html' },
        { name: 'Huaner Robotics (Taobao)', region: 'CN', price_usd: 54, note: '¥65/ea · fast CN ship', url: 'https://item.taobao.com/item.htm?id=726806937243' },
        { name: 'TheRobotStudio Kit', region: 'US', price_usd: 130, note: 'Full SO-ARM100 kit incl. printed parts', url: 'https://www.therobotstudio.com' },
        { name: 'Amazon US (FiHomey)', region: 'US', price_usd: 108, note: '$18/ea · Prime shipping', url: 'https://www.amazon.com/s?k=STS3215+servo' },
      ],
    },
    {
      component: 'Waveshare servo driver board',
      qty: 1,
      suppliers: [
        { name: 'Waveshare Official', region: 'CN', price_usd: 18, note: 'Direct from manufacturer', url: 'https://www.waveshare.com/bus-servo-adapter-a.htm' },
        { name: 'Amazon US', region: 'US', price_usd: 22, note: 'Prime shipping', url: 'https://www.amazon.com/s?k=waveshare+bus+servo+adapter' },
      ],
    },
    {
      component: '3D Printed Frame',
      qty: 1,
      suppliers: [
        { name: 'Self-print (PLA)', region: 'DIY', price_usd: 8, note: '~300g PLA filament', url: 'https://github.com/TheRobotStudio/SO-ARM100' },
        { name: 'JLCPCB 3D Print', region: 'CN', price_usd: 25, note: 'Nylon SLS · 7-day lead', url: 'https://jlcpcb.com/3d-printing' },
        { name: 'Craftcloud (US)', region: 'US', price_usd: 55, note: 'Local print · 3-day', url: 'https://craftcloud3d.com' },
      ],
    },
  ],

  low_cost_robot_arm: [
    {
      component: 'Dynamixel XL330-M288 (×5)',
      qty: 5,
      suppliers: [
        { name: 'Robotis Official', region: 'KR/US', price_usd: 125, note: '$24.90/ea · official store', url: 'https://www.robotis.us/dynamixel-xl330-m288-t/' },
        { name: 'Trossen Robotics', region: 'US', price_usd: 135, note: 'US warehouse · fast ship', url: 'https://www.trossenrobotics.com/dynamixel-xl330-m288.aspx' },
      ],
    },
    {
      component: 'Dynamixel XL430-W250 (×1)',
      qty: 1,
      suppliers: [
        { name: 'Robotis Official', region: 'KR/US', price_usd: 50, note: 'Official store', url: 'https://www.robotis.us/dynamixel-xl430-w250-t/' },
        { name: 'Trossen Robotics', region: 'US', price_usd: 52, note: 'US stock', url: 'https://www.trossenrobotics.com' },
      ],
    },
  ],

  franka_emika_panda: [
    {
      component: 'Panda Robot Arm (complete)',
      qty: 1,
      suppliers: [
        { name: 'Franka Robotics', region: 'DE', price_usd: 10000, note: 'Academic pricing · includes FCI', url: 'https://franka.de' },
        { name: 'eBay / Used Market', region: 'US/EU', price_usd: 5500, note: 'Refurbished · verify firmware', url: 'https://www.ebay.com/sch/i.html?_nkw=franka+panda+robot' },
        { name: 'Robot Marketplace', region: 'US', price_usd: 8000, note: 'Certified refurb · 90-day warranty', url: 'https://robotmarketplace.com' },
      ],
    },
  ],

  universal_robots_ur5e: [
    {
      component: 'UR5e Collaborative Arm',
      qty: 1,
      suppliers: [
        { name: 'Universal Robots', region: 'DK/US', price_usd: 35000, note: 'New · 3-year warranty', url: 'https://www.universal-robots.com/products/ur5-robot/' },
        { name: 'Hirebotics (lease)', region: 'US', price_usd: 1650, note: '$1,650/mo all-in lease', url: 'https://hirebotics.com' },
        { name: 'eBay / Used', region: 'US', price_usd: 18000, note: 'Used · verify hours & condition', url: 'https://www.ebay.com/sch/i.html?_nkw=ur5e' },
        { name: 'Machina Labs (rental)', region: 'US', price_usd: 3500, note: '$3,500/mo full-service', url: 'https://machinalabs.ai' },
      ],
    },
  ],

  kuka_iiwa_14: [
    {
      component: 'KUKA iiwa 14 (complete system)',
      qty: 1,
      suppliers: [
        { name: 'KUKA Direct', region: 'DE/US', price_usd: 80000, note: 'Includes controller · negotiated pricing', url: 'https://www.kuka.com/en-us/products/robot-systems/industrial-robots/lbr-iiwa' },
        { name: 'Used / Surplus', region: 'US', price_usd: 25000, note: 'eBay/surplus · verify controller version', url: 'https://www.ebay.com/sch/i.html?_nkw=kuka+iiwa' },
      ],
    },
  ],

  trossen_vx300s: [
    {
      component: 'ViperX 300 S (complete)',
      qty: 1,
      suppliers: [
        { name: 'Trossen Robotics', region: 'US', price_usd: 5495, note: 'Official · US stock · ROS ready', url: 'https://www.trossenrobotics.com/viperx-300-robot-arm-6dof.aspx' },
      ],
    },
  ],

  unitree_go2: [
    {
      component: 'Go2 Quadruped',
      qty: 1,
      suppliers: [
        { name: 'Unitree Official', region: 'CN', price_usd: 1600, note: 'Go2 Air · basic edu version', url: 'https://www.unitree.com/go2/' },
        { name: 'Unitree US (DroidRobot)', region: 'US', price_usd: 1750, note: 'US warehouse · faster ship', url: 'https://droidrobot.com/unitree-go2' },
        { name: 'Unitree Go2 Pro', region: 'CN', price_usd: 2800, note: 'Pro · better sensors + onboard compute', url: 'https://www.unitree.com/go2/' },
      ],
    },
  ],

  unitree_h1: [
    {
      component: 'H1 Humanoid Robot',
      qty: 1,
      suppliers: [
        { name: 'Unitree Official', region: 'CN', price_usd: 90000, note: 'Full system · includes dev kit', url: 'https://www.unitree.com/h1/' },
        { name: 'Unitree US Partner', region: 'US', price_usd: 95000, note: 'US support · faster delivery', url: 'https://www.unitree.com/h1/' },
      ],
    },
  ],

  unitree_g1: [
    {
      component: 'G1 Humanoid Robot',
      qty: 1,
      suppliers: [
        { name: 'Unitree Official', region: 'CN', price_usd: 16000, note: 'Edu version · includes SDK', url: 'https://www.unitree.com/g1/' },
        { name: 'Unitree US Partner', region: 'US', price_usd: 17500, note: 'US warehouse · includes support', url: 'https://www.unitree.com/g1/' },
      ],
    },
  ],

  boston_dynamics_spot: [
    {
      component: 'Spot (base)',
      qty: 1,
      suppliers: [
        { name: 'Boston Dynamics', region: 'US', price_usd: 74750, note: 'Base model · no arm', url: 'https://www.bostondynamics.com/products/spot' },
        { name: 'Spot + Arm bundle', region: 'US', price_usd: 100000, note: 'Includes payload arm', url: 'https://www.bostondynamics.com/products/spot' },
      ],
    },
  ],

  aloha: [
    {
      component: 'ViperX 300 (×2)',
      qty: 2,
      suppliers: [
        { name: 'Trossen Robotics', region: 'US', price_usd: 10990, note: '2× ViperX 300 · full ALOHA BOM', url: 'https://www.trossenrobotics.com/viperx-300-robot-arm-6dof.aspx' },
      ],
    },
    {
      component: 'ALOHA hardware kit',
      qty: 1,
      suppliers: [
        { name: 'Trossen ALOHA Kit', region: 'US', price_usd: 20000, note: 'Complete kit per ACT paper BOM', url: 'https://docs.google.com/document/d/1_3yhWjodSNNYlpxkRCPIlvIAaQ76Nqk2wsqhnEVM6Dc' },
      ],
    },
  ],

  robotiq_2f85: [
    {
      component: 'Robotiq 2F-85 Gripper',
      qty: 1,
      suppliers: [
        { name: 'Robotiq Official', region: 'CA/US', price_usd: 4200, note: 'New · includes cable & adapter', url: 'https://robotiq.com/products/2f85-140-adaptive-robot-gripper' },
        { name: 'Used / eBay', region: 'US', price_usd: 1800, note: 'Used · verify firmware version', url: 'https://www.ebay.com/sch/i.html?_nkw=robotiq+2f-85' },
      ],
    },
  ],
};

export function getRobotSuppliers(robotId: string): SupplierEntry[] {
  return ROBOT_SUPPLIERS[robotId] ?? [];
}
