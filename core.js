/* WORLD IS YOUR STUDY — shared game core. Loaded by the web app AND by Cloud Functions (functions/core.js is a copy made at deploy). */
/* ============ WORLD IS YOUR STUDY — content & economy data ============ */
'use strict';
const APP_VERSION = 1;

/* ---- Economy constants (tune here) ---- */
const ECON = {
  xpPerMin: 5,            // base XP per valid study minute
  coinPerMin: 1,          // base coins per valid study minute
  minSessionMin: 2,       // shorter sessions are discarded
  maxSessionMin: 240,     // one session counts at most 4h
  maxDailyMin: 600,       // rewards stop after 10h/day
  studyDayMin: 10,        // minutes needed for a day to count toward streak
  chestEveryMin: 60,      // wooden chest progress
  focusBonus: 0.10,       // countdown finished as planned
  streakBonusPerDay: 0.01, streakBonusCap: 0.30,
  comboXpBonus: 0.20,
};

/* Micro-milestones inside one session: minute -> reward */
const MILESTONES = [
  {m:5,  xp:10,  label:'Warm-up'},
  {m:10, xp:15,  label:'Settled in'},
  {m:15, coins:5, label:'Quarter mark'},
  {m:20, xp:25, label:'Focus streak'},
  {m:30, coins:15, xp:20, label:'Half hour'},
  {m:45, xp:40, label:'Deep focus'},
  {m:60, coins:25, xp:50, label:'Full hour'},
  {m:90, mat:2, xp:60, label:'Builder bonus'},
  {m:120, coins:40, xp:80, label:'Marathon'},
  {m:180, coins:60, xp:120, label:'Legend run'},
];

/* ---- Level curve: XP to go from level n to n+1 = round(100 * n^1.45) ---- */
const LEVEL_CUM = (() => { const a=[0,0]; for(let n=1;n<400;n++) a.push(a[n]+Math.round(100*Math.pow(n,1.45))); return a; })();
function levelFromXp(xp){ let l=1; while(l<399 && xp>=LEVEL_CUM[l+1]) l++; return l; }
function levelProgress(xp){ const l=levelFromXp(xp); const a=LEVEL_CUM[l], b=LEVEL_CUM[l+1]; return {level:l, into:xp-a, need:b-a, pct:(xp-a)/(b-a)}; }

/* ---- Town Hall levels ---- */
const TOWNHALL = [
  null,
  {name:'Small Settlement', icon:'🌱', lvl:1,  coins:0,     mat:0},
  {name:'Village',          icon:'🏡', lvl:2,  coins:150,   mat:0},
  {name:'Growing Town',     icon:'🏘️', lvl:4,  coins:400,   mat:0},
  {name:'Town',             icon:'🏘️', lvl:7,  coins:900,   mat:2},
  {name:'Large Town',       icon:'🏙️', lvl:10, coins:1600,  mat:5},
  {name:'City',             icon:'🏙️', lvl:14, coins:2800,  mat:10},
  {name:'Major City',       icon:'🌆', lvl:18, coins:4500,  mat:16},
  {name:'Metropolitan City',icon:'🌆', lvl:23, coins:7000,  mat:24},
  {name:'Advanced Civilization', icon:'🌇', lvl:29, coins:10000, mat:34},
  {name:'Nation I',         icon:'🌇', lvl:35, coins:14000, mat:46},
  {name:'Nation II',        icon:'🗺️', lvl:42, coins:19000, mat:60},
  {name:'Nation III',       icon:'🌍', lvl:50, coins:26000, mat:80},
];
const TH_MAX = TOWNHALL.length-1;
const gridSizeFor = th => 10 + 2*th;               // tiles per side
const buildSlotsFor = th => 1 + Math.floor(th/3);  // parallel constructions

/* ---- Building catalog ----
   k: model kind for the 3D builder. min: study minutes to construct (0 = instant).
   Add new buildings by appending rows; nothing else needs to change. */
const CATS = {res:'Residential',gov:'Government',edu:'Education',trn:'Transport',com:'Commercial',ind:'Industrial',agr:'Agriculture',utl:'Utilities',rec:'Recreation',hlt:'Health',nat:'National',dec:'Decor'};
const BUILDINGS = [
 // Residential
 {id:'hut',n:'Hut',i:'🛖',c:'res',th:1,cost:40,min:10,pop:3,m:{k:'house',col:'#c9a36b',roof:'#7d5234',h:.45,s:.55}},
 {id:'house_s',n:'Small House',i:'🏠',c:'res',th:1,cost:90,min:15,pop:5,m:{k:'house',col:'#f1e3c8',roof:'#c0533f',h:.55,s:.7}},
 {id:'house_m',n:'Medium House',i:'🏠',c:'res',th:2,cost:180,min:30,pop:9,m:{k:'house',col:'#e3ecf4',roof:'#3f6fb0',h:.75,s:.8}},
 {id:'house_l',n:'Large House',i:'🏡',c:'res',th:3,cost:320,min:45,pop:14,m:{k:'house',col:'#f3d9b1',roof:'#6b4a8a',h:.95,s:.88}},
 {id:'villa',n:'Villa',i:'🏖️',c:'res',th:4,cost:600,min:60,pop:10,m:{k:'villa',col:'#fbf6ee',roof:'#d98e5f'}},
 {id:'apartment',n:'Apartments',i:'🏢',c:'res',th:5,cost:900,min:90,pop:48,m:{k:'tower',col:'#d8c6a8',fl:5,s:.8}},
 {id:'highrise',n:'High-rise',i:'🏢',c:'res',th:7,cost:2000,min:150,pop:120,m:{k:'tower',col:'#9fb7cf',fl:10,s:.78,glass:1}},
 {id:'skyscraper',n:'Skyscraper',i:'🏙️',c:'res',th:9,cost:4000,min:240,pop:280,w:2,d:2,m:{k:'tower',col:'#6f95bd',fl:18,s:1.6,glass:1}},
 // Government
 {id:'office',n:'Gov. Office',i:'🏛️',c:'gov',th:4,cost:500,min:60,jobs:20,m:{k:'block',col:'#dcd3c0',fl:3}},
 {id:'police',n:'Police Station',i:'🚓',c:'gov',th:4,cost:450,min:60,jobs:12,m:{k:'block',col:'#3d5a8a',fl:2,sign:'#4ea3ff'}},
 {id:'fire',n:'Fire Station',i:'🚒',c:'gov',th:4,cost:450,min:60,jobs:12,m:{k:'block',col:'#c0392b',fl:2,sign:'#ffd166'}},
 {id:'court',n:'Court',i:'⚖️',c:'gov',th:6,cost:1200,min:120,jobs:25,m:{k:'civic',col:'#ece6d6'}},
 {id:'admin',n:'Admin Complex',i:'🏛️',c:'gov',th:8,cost:2500,min:180,jobs:60,w:2,d:2,m:{k:'civic',col:'#e2dccb',big:1}},
 // Education
 {id:'school',n:'School',i:'🏫',c:'edu',th:2,cost:250,min:40,jobs:10,m:{k:'block',col:'#e7b35a',fl:2,sign:'#2a9d8f'}},
 {id:'library',n:'Library',i:'📚',c:'edu',th:3,cost:350,min:60,jobs:8,m:{k:'civic',col:'#d9cbb0'}},
 {id:'college',n:'College',i:'🎓',c:'edu',th:5,cost:1100,min:120,jobs:30,w:2,m:{k:'block',col:'#b5654a',fl:3}},
 {id:'university',n:'University Campus',i:'🎓',c:'edu',th:7,cost:2600,min:200,jobs:60,w:2,d:2,m:{k:'campus',col:'#b86b4b'}},
 {id:'research',n:'Research Center',i:'🔬',c:'edu',th:8,cost:3000,min:220,jobs:40,m:{k:'dome',col:'#e8eef2'}},
 // Transport
 {id:'road',n:'Road',i:'🛣️',c:'trn',th:1,cost:5,min:0,m:{k:'road'}},
 {id:'busstop',n:'Bus Stop',i:'🚏',c:'trn',th:3,cost:60,min:5,m:{k:'busstop'}},
 {id:'parking',n:'Parking Lot',i:'🅿️',c:'trn',th:3,cost:100,min:10,m:{k:'parking'}},
 {id:'busterm',n:'Bus Terminal',i:'🚌',c:'trn',th:5,cost:700,min:60,jobs:10,w:2,m:{k:'station',col:'#4f8fbf'}},
 {id:'rail',n:'Railway Track',i:'🛤️',c:'trn',th:6,cost:25,min:0,m:{k:'rail'}},
 {id:'station',n:'Railway Station',i:'🚉',c:'trn',th:6,cost:1500,min:120,jobs:20,w:2,m:{k:'station',col:'#a0522d'}},
 {id:'airport',n:'Airport',i:'✈️',c:'trn',th:9,cost:6000,min:300,jobs:120,w:3,d:3,m:{k:'airport'}},
 // Commercial
 {id:'shop',n:'Shop',i:'🏪',c:'com',th:2,cost:150,min:20,jobs:4,m:{k:'block',col:'#f4a261',fl:1,awn:'#e63946'}},
 {id:'market',n:'Market',i:'🧺',c:'com',th:3,cost:300,min:35,jobs:10,m:{k:'market'}},
 {id:'restaurant',n:'Restaurant',i:'🍽️',c:'com',th:3,cost:280,min:35,jobs:8,m:{k:'block',col:'#e76f51',fl:1,awn:'#2a9d8f'}},
 {id:'atm',n:'ATM Kiosk',i:'🏧',c:'com',th:4,cost:60,min:5,m:{k:'kiosk'}},
 {id:'bank',n:'Bank',i:'🏦',c:'com',th:5,cost:900,min:90,jobs:15,m:{k:'civic',col:'#cfd8dc'}},
 {id:'hotel',n:'Hotel',i:'🏨',c:'com',th:6,cost:1400,min:120,jobs:30,m:{k:'tower',col:'#c98f6b',fl:6,s:.8}},
 {id:'mall',n:'Shopping Center',i:'🛍️',c:'com',th:7,cost:2400,min:180,jobs:70,w:2,d:2,m:{k:'block',col:'#9ad1d4',fl:2,awn:'#ef476f'}},
 // Industrial
 {id:'warehouse',n:'Warehouse',i:'📦',c:'ind',th:4,cost:500,min:50,jobs:15,m:{k:'shed',col:'#8d99ae'}},
 {id:'factory',n:'Factory',i:'🏭',c:'ind',th:5,cost:1000,min:90,jobs:40,m:{k:'factory',col:'#9c6644'}},
 {id:'logistics',n:'Logistics Center',i:'🚚',c:'ind',th:6,cost:1300,min:110,jobs:35,w:2,m:{k:'shed',col:'#6d7f99'}},
 {id:'indplant',n:'Industrial Plant',i:'🏭',c:'ind',th:8,cost:2600,min:200,jobs:90,w:2,d:2,m:{k:'factory',col:'#7f8c8d',big:1}},
 // Agriculture
 {id:'farm_s',n:'Small Farm',i:'🌾',c:'agr',th:1,cost:60,min:10,jobs:3,m:{k:'farm',crop:'#d8c35a'}},
 {id:'farm_l',n:'Large Farm',i:'🚜',c:'agr',th:3,cost:250,min:40,jobs:8,w:2,d:2,m:{k:'farm',crop:'#9bc45a'}},
 {id:'greenhouse',n:'Greenhouse',i:'🪴',c:'agr',th:4,cost:400,min:50,jobs:8,m:{k:'greenhouse'}},
 {id:'silo',n:'Grain Storage',i:'🌽',c:'agr',th:4,cost:300,min:40,jobs:4,m:{k:'silo'}},
 {id:'irrigation',n:'Irrigation Pump',i:'💧',c:'agr',th:5,cost:350,min:40,jobs:2,m:{k:'tank',col:'#6fb3d9',low:1}},
 // Utilities
 {id:'watertank',n:'Water Tank',i:'🚰',c:'utl',th:2,cost:150,min:20,m:{k:'tank',col:'#b8c4cf'}},
 {id:'generator',n:'Power Generator',i:'⚡',c:'utl',th:3,cost:400,min:45,jobs:5,pw:20,m:{k:'shed',col:'#f2c14e'}},
 {id:'solar',n:'Solar Farm',i:'☀️',c:'utl',th:4,cost:350,min:40,pw:12,m:{k:'solar'}},
 {id:'gas',n:'Gas Station',i:'⛽',c:'utl',th:5,cost:450,min:45,jobs:5,m:{k:'gas'}},
 {id:'comtower',n:'Comms Tower',i:'📡',c:'utl',th:5,cost:600,min:60,m:{k:'antenna'}},
 {id:'wind',n:'Wind Turbine',i:'🌬️',c:'utl',th:5,cost:500,min:50,pw:18,m:{k:'wind'}},
 {id:'waste',n:'Waste Management',i:'♻️',c:'utl',th:6,cost:800,min:70,jobs:15,m:{k:'shed',col:'#7c8b5a'}},
 {id:'powerplant',n:'Power Plant',i:'🔌',c:'utl',th:6,cost:2000,min:160,jobs:40,pw:120,w:2,d:2,m:{k:'factory',col:'#b0b8c0',cool:1}},
 // Recreation
 {id:'park',n:'Park',i:'🌳',c:'rec',th:1,cost:50,min:5,m:{k:'park'}},
 {id:'playground',n:'Playground',i:'🛝',c:'rec',th:2,cost:90,min:10,m:{k:'park',play:1}},
 {id:'cinema',n:'Cinema',i:'🎬',c:'rec',th:5,cost:900,min:80,jobs:12,m:{k:'block',col:'#6a3d9a',fl:2,sign:'#ffd166'}},
 {id:'entertain',n:'Entertainment Center',i:'🎡',c:'rec',th:7,cost:2000,min:150,jobs:40,w:2,d:2,m:{k:'dome',col:'#ff8fab'}},
 {id:'stadium',n:'Stadium',i:'🏟️',c:'rec',th:8,cost:5000,min:300,jobs:60,w:3,d:3,m:{k:'stadium'}},
 // Health
 {id:'clinic',n:'Clinic',i:'🏥',c:'hlt',th:3,cost:350,min:45,jobs:10,m:{k:'block',col:'#f4f6f8',fl:2,cross:1}},
 {id:'hospital',n:'Hospital',i:'🏥',c:'hlt',th:6,cost:2200,min:180,jobs:80,w:2,d:2,m:{k:'tower',col:'#eef2f6',fl:5,s:1.6,cross:1}},
 // National infrastructure (visual only)
 {id:'armybase',n:'Army Base',i:'🪖',c:'nat',th:10,cost:8000,min:360,jobs:100,w:3,d:3,m:{k:'base',col:'#6b7d4f'}},
 {id:'navalbase',n:'Naval Harbor',i:'⚓',c:'nat',th:11,cost:9000,min:400,jobs:120,w:3,d:2,m:{k:'harbor'}},
 {id:'airbase',n:'Air Force Base',i:'🛩️',c:'nat',th:12,cost:12000,min:480,jobs:150,w:3,d:3,m:{k:'airport',mil:1}},
 // Decor (instant)
 {id:'tree',n:'Tree',i:'🌲',c:'dec',th:1,cost:10,min:0,m:{k:'tree'}},
 {id:'lamp',n:'Street Light',i:'💡',c:'dec',th:1,cost:15,min:0,m:{k:'lamp'}},
 {id:'bench',n:'Bench',i:'🪑',c:'dec',th:1,cost:8,min:0,m:{k:'bench'}},
 {id:'flowers',n:'Flower Bed',i:'🌷',c:'dec',th:1,cost:12,min:0,m:{k:'flowers'}},
 {id:'flag',n:'City Flag',i:'🚩',c:'dec',th:2,cost:40,min:0,m:{k:'flag'}},
 {id:'fountain',n:'Fountain',i:'⛲',c:'dec',th:3,cost:150,min:0,m:{k:'fountain'}},
 {id:'statue',n:'Scholar Statue',i:'🗿',c:'dec',th:4,cost:300,min:0,m:{k:'statue'}},
 // Chest-only rewards (cost null = cannot be bought)
 {id:'goldtree',n:'Golden Tree',i:'✨',c:'dec',th:1,cost:null,min:0,m:{k:'tree',gold:1}},
 {id:'trophy',n:'Trophy Monument',i:'🏆',c:'dec',th:1,cost:null,min:0,m:{k:'statue',gold:1}},
 {id:'lighthouse',n:'Lighthouse',i:'🗼',c:'dec',th:1,cost:null,min:0,m:{k:'lighthouse'}},
];
BUILDINGS.forEach(b=>{ b.w=b.w||1; b.d=b.d||1; b.mat = b.cost ? Math.floor(b.cost/1500) : 0; });
const BMAP = Object.fromEntries(BUILDINGS.map(b=>[b.id,b]));

/* ---- Chests (probabilities shown to players) ---- */
const CHESTS = {
  wooden:   {n:'Wooden Chest',   i:'🪵', col:'#b07a45', table:[[70,'coins',20,50],[20,'xp',50,120],[10,'decor','common']]},
  silver:   {n:'Silver Chest',   i:'🥈', col:'#c3ced8', table:[[50,'coins',60,150],[25,'xp',150,300],[15,'mat',1,3],[10,'decor','common']]},
  gold:     {n:'Gold Chest',     i:'🥇', col:'#f5bf4f', table:[[40,'coins',150,350],[25,'mat',3,6],[20,'boost',1.5,60],[15,'decor','rare']]},
  crystal:  {n:'Crystal Chest',  i:'💎', col:'#6fe3ff', table:[[35,'coins',400,800],[30,'mat',6,12],[20,'boost',2,60],[15,'decor','epic']]},
  legendary:{n:'Legendary Chest',i:'👑', col:'#c792ff', table:[[30,'coins',1000,2000],[30,'mat',15,25],[20,'boost',2,120],[20,'decor','legend']]},
};
const CHEST_ORDER = ['wooden','silver','gold','crystal','legendary'];
const DECOR_POOL = {common:['tree','flowers','bench','lamp'], rare:['fountain','goldtree'], epic:['statue','trophy'], legend:['lighthouse','trophy']};

/* ---- Leagues ---- */
const LEAGUES = [
  {id:'bronze',n:'Bronze',col:'#cd8b5a',promo:600},
  {id:'silver',n:'Silver',col:'#c3ced8',promo:1200},
  {id:'gold',n:'Gold',col:'#f5bf4f',promo:2000},
  {id:'platinum',n:'Platinum',col:'#7fe0d0',promo:3000},
  {id:'diamond',n:'Diamond',col:'#6fb8ff',promo:4200},
  {id:'master',n:'Master',col:'#c792ff',promo:Infinity},
];

/* ---- Achievements: data-driven, extendable (config/content can add more) ----
   metric names resolve against computeMetrics(). */
const BADGES = [
 // Study
 {id:'first_session',n:'First Study Session',i:'📘',cat:'Study',metric:'sessions',t:1,r:{coins:20}},
 {id:'first_hour',n:'First Hour',i:'⏱️',cat:'Study',metric:'totalMin',t:60,r:{coins:30}},
 {id:'ten_hours',n:'Ten Hours In',i:'📚',cat:'Study',metric:'totalMin',t:600,r:{coins:100,chest:'silver'}},
 {id:'fifty_hours',n:'Fifty Hours',i:'🧱',cat:'Study',metric:'totalMin',t:3000,r:{coins:300,chest:'gold'}},
 {id:'early_bird',n:'Early Bird',i:'🌅',cat:'Study',metric:'earlySessions',t:1,r:{coins:25}},
 {id:'night_scholar',n:'Night Scholar',i:'🌙',cat:'Study',metric:'nightSessions',t:1,r:{coins:25}},
 {id:'deep_focus',n:'Deep Focus',i:'🧠',cat:'Study',metric:'longSessions45',t:5,r:{coins:60}},
 {id:'marathon',n:'Marathon Session',i:'🏃',cat:'Study',metric:'longestSession',t:120,r:{coins:80,mat:2}},
 {id:'topic_master',n:'Topic Master',i:'✅',cat:'Study',metric:'topicsDone',t:10,r:{coins:60}},
 {id:'subject_explorer',n:'Subject Explorer',i:'🧭',cat:'Study',metric:'subjectsStudied',t:4,r:{coins:50}},
 {id:'task_crusher',n:'Task Crusher',i:'📝',cat:'Study',metric:'tasksDone',t:25,r:{coins:80}},
 // Consistency
 {id:'streak3',n:'3 Day Streak',i:'🔥',cat:'Consistency',metric:'bestStreak',t:3,r:{coins:30}},
 {id:'streak5',n:'5 Day Streak',i:'🔥',cat:'Consistency',metric:'bestStreak',t:5,r:{coins:50}},
 {id:'streak7',n:'7 Day Streak',i:'🔥',cat:'Consistency',metric:'bestStreak',t:7,r:{coins:70,chest:'gold'}},
 {id:'streak10',n:'10 Day Streak',i:'🔥',cat:'Consistency',metric:'bestStreak',t:10,r:{coins:100}},
 {id:'streak14',n:'14 Day Streak',i:'🔥',cat:'Consistency',metric:'bestStreak',t:14,r:{coins:140,mat:3}},
 {id:'streak30',n:'30 Day Streak',i:'🌋',cat:'Consistency',metric:'bestStreak',t:30,r:{coins:300,chest:'crystal'}},
 {id:'consistency_master',n:'Consistency Master',i:'📅',cat:'Consistency',metric:'studyDays30',t:25,r:{coins:250}},
 {id:'comeback',n:'Comeback',i:'↩️',cat:'Consistency',metric:'comebacks',t:1,r:{coins:40}},
 // Competition
 {id:'league_climber',n:'League Climber',i:'📈',cat:'Competition',metric:'promotions',t:1,r:{coins:80}},
 {id:'top_performer',n:'Top Performer',i:'🥉',cat:'Competition',metric:'top3Weeks',t:1,r:{coins:80}},
 {id:'weekly_champion',n:'Weekly Champion',i:'🏆',cat:'Competition',metric:'weekWins',t:1,r:{coins:150,chest:'gold'}},
 {id:'rival_crusher',n:'Rival Crusher',i:'⚔️',cat:'Competition',metric:'duelsWon',t:3,r:{coins:120}},
 // Social
 {id:'first_friend',n:'First Friend',i:'🤝',cat:'Social',metric:'friends',t:1,r:{coins:30}},
 {id:'study_partner',n:'Study Partner',i:'👥',cat:'Social',metric:'friends',t:3,r:{coins:60}},
 {id:'challenge_accepted',n:'Challenge Accepted',i:'🎯',cat:'Social',metric:'challengesDone',t:1,r:{coins:40}},
 {id:'team_player',n:'Team Player',i:'🧩',cat:'Social',metric:'challengesDone',t:5,r:{coins:120}},
 {id:'helpful_friend',n:'Helpful Friend',i:'💬',cat:'Social',metric:'challengesSent',t:5,r:{coins:60}},
 {id:'cheerleader',n:'Cheerleader',i:'👏',cat:'Social',metric:'reactionsGiven',t:10,r:{coins:30}},
 // Civilization
 {id:'first_house',n:'First House',i:'🏠',cat:'Civilization',metric:'houses',t:1,r:{coins:20}},
 {id:'first_farm',n:'First Farm',i:'🌾',cat:'Civilization',metric:'farms',t:1,r:{coins:20}},
 {id:'first_road',n:'First Road',i:'🛣️',cat:'Civilization',metric:'roads',t:1,r:{coins:10}},
 {id:'first_townhall',n:'First Town Hall Upgrade',i:'🏛️',cat:'Civilization',metric:'th',t:2,r:{coins:50}},
 {id:'city_builder',n:'City Builder',i:'🏗️',cat:'Civilization',metric:'buildings',t:25,r:{coins:150,mat:3}},
 {id:'industrialist',n:'Industrialist',i:'🏭',cat:'Civilization',metric:'industry',t:3,r:{coins:200}},
 {id:'metropolitan',n:'Metropolitan',i:'🌆',cat:'Civilization',metric:'th',t:8,r:{coins:500,chest:'crystal'}},
 {id:'civ_master',n:'Civilization Master',i:'🌍',cat:'Civilization',metric:'th',t:12,r:{coins:1000,chest:'legendary'}},
 {id:'population_1k',n:'Thousand Citizens',i:'👪',cat:'Civilization',metric:'population',t:1000,r:{coins:200}},
 // Progress
 {id:'level5',n:'Level 5',i:'⭐',cat:'Progress',metric:'level',t:5,r:{coins:50}},
 {id:'level10',n:'Level 10',i:'🌟',cat:'Progress',metric:'level',t:10,r:{coins:120,chest:'silver'}},
 {id:'level25',n:'Level 25',i:'💫',cat:'Progress',metric:'level',t:25,r:{coins:400,chest:'crystal'}},
 {id:'chest_hunter',n:'Chest Hunter',i:'🎁',cat:'Progress',metric:'chestsOpened',t:10,r:{coins:60}},
];

/* ---- Streak milestone rewards (small & frequent) ---- */
const STREAK_REWARDS = [
  {d:2,coins:10},{d:3,coins:20},{d:4,coins:25},{d:5,coins:30,chest:'wooden'},{d:7,coins:50,chest:'silver'},
  {d:10,coins:70},{d:14,coins:100,chest:'gold'},{d:21,coins:150,mat:3},{d:30,coins:250,chest:'crystal'},
  {d:45,coins:350},{d:60,coins:500,chest:'crystal'},{d:100,coins:1000,chest:'legendary'},
];

/* ---- Daily quest pool. kind decides how progress is derived from today's data ---- */
const DAILY_POOL = [
  {id:'min15',cat:'Time',i:'⏱️',t:'Study for 15 minutes',kind:'minutes',v:15,r:{xp:40}},
  {id:'min30',cat:'Study',i:'📚',t:'Study for 30 minutes',kind:'minutes',v:30,r:{xp:100}},
  {id:'min60',cat:'Time',i:'⏳',t:'Study for 60 minutes',kind:'minutes',v:60,r:{xp:150,coins:30}},
  {id:'sess2',cat:'Study',i:'🔁',t:'Complete 2 study sessions',kind:'sessions',v:2,r:{xp:60,coins:15}},
  {id:'task2',cat:'Study',i:'📝',t:'Complete 2 tasks',kind:'tasks',v:2,r:{xp:75}},
  {id:'topic1',cat:'Subject',i:'🧠',t:'Complete a topic',kind:'topics',v:1,r:{xp:75}},
  {id:'subj2',cat:'Subject',i:'🔀',t:'Study 2 different subjects',kind:'subjects',v:2,r:{xp:70,coins:15}},
  {id:'focus25',cat:'Study',i:'🎯',t:'Finish a 25+ min countdown',kind:'focus',v:25,r:{xp:80}},
  {id:'streak',cat:'Consistency',i:'🔥',t:'Keep your streak alive',kind:'streakday',v:1,r:{coins:50}},
  {id:'sched',cat:'Consistency',i:'🗓️',t:"Complete today's schedule",kind:'schedule',v:1,r:{chest:'silver'}},
  {id:'friend',cat:'Friend',i:'👏',t:'React to a friend’s activity',kind:'reactions',v:1,r:{coins:20}},
  {id:'build',cat:'Civilization',i:'🏗️',t:'Place or upgrade a building',kind:'builds',v:1,r:{coins:25}},
];
const WEEKLY_POOL = [
  {id:'w_hours',i:'⏳',t:'Study 10 hours',kind:'minutes',v:600,r:{xp:500,coins:150,chest:'gold'}},
  {id:'w_tasks',i:'📝',t:'Complete 15 tasks',kind:'tasks',v:15,r:{xp:300,coins:100}},
  {id:'w_days',i:'📅',t:'Study on 5 different days',kind:'days',v:5,r:{xp:300,mat:4}},
  {id:'w_chal',i:'🤝',t:'Complete 2 friend challenges',kind:'challenges',v:2,r:{coins:150,chest:'silver'}},
  {id:'w_quests',i:'✅',t:'Claim 12 daily quests',kind:'quests',v:12,r:{chest:'crystal'}},
];

const AVATARS = ['🦉','🦊','🐯','🐼','🦁','🐸','🐙','🦄','🐧','🐺','🐨','🦅','🐬','🐝','🦖','🐢'];
const AVATAR_COLS = ['#58d0e8','#f5bf4f','#ff7d5c','#83c96e','#c792ff','#ff8fab','#7fe0d0','#6fb8ff'];
const SUBJECT_COLS = ['#58d0e8','#f5bf4f','#ff7d5c','#83c96e','#c792ff','#ff8fab','#7fe0d0','#6fb8ff','#e9c46a','#f4a261'];
const REACTIONS = ['🔥','👏','💪','🎯','📚'];
const MONTH_TITLES = [
  {id:'scholar',n:'Monthly Scholar',i:'📜',d:'30+ hours studied this month',test:m=>m.min>=1800},
  {id:'consistency',n:'Consistency Master',i:'📅',d:'Studied on 25+ days this month',test:m=>m.days>=25},
  {id:'focus',n:'Focus Master',i:'🧠',d:'20+ sessions of 45 minutes or more',test:m=>m.long45>=20},
  {id:'explorer',n:'Study Explorer',i:'🧭',d:'Studied 5+ different subjects',test:m=>m.subjects>=5},
];
/* ============ Core: utilities, storage, game rules ============ */

/* ---------- utils ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid8 = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2,'0');
const fmtNum = n => Math.round(n||0).toLocaleString('en-US');
function fmtMin(m){ m=Math.round(m||0); const h=Math.floor(m/60), r=m%60; return h ? `${h}h ${pad2(r)}m` : `${r}m`; }
function fmtClock(sec){ sec=Math.max(0,Math.floor(sec)); const h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), s=sec%60; return (h? h+':'+pad2(m) : pad2(m)) + ':' + pad2(s); }
function nowMs(){ return Date.now() + (G.skew||0); }
function tzNow(ts){ return new Date((ts===undefined? nowMs() : ts) + (G.tzMin||0)*60000); } // read with getUTC* = player's wall clock
const localHour = ts => tzNow(ts).getUTCHours();
function dayKey(d=tzNow()){ return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate()); }
function parseDay(k){ const [y,m,d]=k.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)); }
function addDays(k, n){ const d=parseDay(k); d.setUTCDate(d.getUTCDate()+n); return dayKey(d); }
function weekKey(d=tzNow()){ // ISO week
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(),0,1));
  const wk = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + pad2(wk);
}
function weekStart(d=tzNow()){ const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); const wd=(x.getUTCDay()+6)%7; x.setUTCDate(x.getUTCDate()-wd); return x; }
function prevWeekDate(){ const x=weekStart(); x.setUTCDate(x.getUTCDate()-1); return x; }
function weekEndsAt(){ const x=weekStart(); return x.getTime()+7*86400000-(G.tzMin||0)*60000; }
function weekDays(d=tzNow()){ const s=weekStart(d); return Array.from({length:7},(_,i)=>{const x=new Date(s); x.setUTCDate(s.getUTCDate()+i); return dayKey(x);}); }
function monthKey(d=tzNow()){ return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1); }
function timeAgo(ts){ const s=(nowMs()-ts)/1000; if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago'; if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }
function seeded(str){ let h=2166136261; for(const c of str){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return () => { h^=h<<13; h^=h>>>17; h^=h<<5; return ((h>>>0)%100000)/100000; }; }
function hashId(str){ let h=0; for(const c of str) h=(h*31+c.charCodeAt(0))>>>0; return h.toString(36).toUpperCase().padStart(6,'0').slice(-6); }
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const dowOf = k => (parseDay(k).getUTCDay()+6)%7;

/* ---------- global app context ---------- */
const G = {
  db:null, user:null, uid:null, canWrite:true, ready:false, offline:false,
  S:null,               // my private state
  players:{},           // uid -> public doc (includes demo players)
  config:{badges:[], announce:''},
  monthLog:[],          // sessions of current month
  dev: uid8(), tzMin: 0, skew: 0, server:false, msgs:[], onToast:null,
  view:'home', viewArg:null,
  worldTarget:null,     // uid being viewed in world (null = mine)
  toastQ:[],
};

function newState(){
  return {
    v:APP_VERSION, rev:0, dev:G.dev, createdAt:Date.now(),
    profile:null, onboard:0, goalMin:60,
    subjects:[], tasks:[], schedule:[],
    active:null, lastSessionEnd:0,
    xp:0, coins:0, mat:0,
    daily:{}, stats:{sessions:0,totalMin:0,longest:0,early:0,night:0,long45:0,topicsDone:0,tasksDone:0,chestsOpened:0,reactionsGiven:0,challengesSent:0,challengesDone:0,duelsWon:0,comebacks:0,promotions:0,top3Weeks:0,weekWins:0,fcp:0,subjectsStudied:[]},
    bestStreak:0, streakClaims:{run:'',got:[]},
    chestMin:0, chestEarned:0, chests:{wooden:0,silver:0,gold:0,crystal:0,legendary:0}, inv:{}, boost:null,
    badges:{}, weeklyClaimed:{},
    city:{th:1, b:[], flag:'#f5bf4f'},
    league:{tier:0, hist:[], lastWk:weekKey(), seenWk:''},
    social:{friends:[], declined:[], chOut:[], chState:{}, reactions:{}, feed:[]},
    privacy:{city:true, stats:true, today:true, studying:true},
    notif:{friend:true,challenge:true,quest:true,streak:true,league:true,build:true,badge:true,chest:true,sched:true,friendAch:true},
    gfx:'auto', dayMode:'real', weather:'auto', notifSeen:0,
  };
}

/* ---------- hooks (the host app plugs these in) ---------- */
function save(){}                        // persistence is done by the caller of an action
function toast(m,k){ if(G.server) G.msgs.push([m,k||'info']); else if(G.onToast) G.onToast(m,k); }

/* ---------- derived numbers ---------- */
const today = () => G.S.daily[dayKey()] || emptyDay();
function emptyDay(){ return {min:0,xp:0,coins:0,n:0,tasks:0,topics:0,subj:{},focus:0,sched:[],hours:{},long45:0,react:0,builds:0,quests:[],combo:0,chal:0}; }
function dayRec(k=dayKey()){ if(!G.S.daily[k]) G.S.daily[k]=emptyDay(); return G.S.daily[k]; }
function isStudyDay(k){ const d=G.S.daily[k]; return !!(d && d.min>=ECON.studyDayMin); }
function currentStreak(){
  let k=dayKey(), n=0;
  if(!isStudyDay(k)) k=addDays(k,-1);
  while(isStudyDay(k)){ n++; k=addDays(k,-1); if(n>3650) break; }
  return n;
}
function streakRunId(){ // id of current streak run = first day of it
  let k=dayKey(); if(!isStudyDay(k)) k=addDays(k,-1);
  if(!isStudyDay(k)) return '';
  while(isStudyDay(addDays(k,-1))) k=addDays(k,-1);
  return k;
}
function weekAgg(d=tzNow()){
  const days=weekDays(d); const a={min:0,xp:0,tasks:0,days:0,n:0};
  days.forEach(k=>{ const r=G.S.daily[k]; if(!r) return; a.min+=r.min; a.xp+=r.xp; a.tasks+=r.tasks; a.n+=r.n; if(r.min>=ECON.studyDayMin) a.days++; });
  return a;
}
function rangeDays(n){ const out=[]; let k=dayKey(); for(let i=0;i<n;i++){ out.unshift(k); k=addDays(k,-1);} return out; }
function consistency(n=30){ const ds=rangeDays(n); const c=ds.filter(isStudyDay).length; return {days:c, of:n, pct:Math.round(c/n*100)}; }
function lvl(){ return levelFromXp(G.S.xp); }

function cityStats(city){
  const b=(city&&city.b)||[]; let housing=0,jobs=0,power=0,roads=0,services=0,decor=0,built=0;
  b.forEach(x=>{ const d=BMAP[x.id]; if(!d) return; const done = x.done!==false; if(!done) return; built++;
    housing+=d.pop||0; jobs+=d.jobs||0; power+=d.pw||0;
    if(d.id==='road'||d.id==='rail') roads++;
    if(['gov','edu','hlt','rec','utl'].includes(d.c)) services++;
    if(d.c==='dec') decor++;
  });
  const th = (city&&city.th)||1;
  const happiness = clamp(0.55 + services*0.04 + decor*0.01 + (roads>0?0.1:0), 0.5, 1);
  const population = Math.round(housing * happiness * 10) + th*6; // 10 citizens per housing unit
  const employment = population ? clamp(Math.round(jobs*10 / Math.max(1,population*0.55) * 100), 0, 100) : 0;
  const need = Math.max(1, built - roads);
  const infrastructure = clamp(Math.round(((roads*0.6) + services*1.5 + power/10) / need * 100), 0, 100);
  const powerNeed = Math.round((housing + jobs)/3);
  return {housing:housing*10+th*8, population, jobs:jobs*10, employment, infrastructure, power, powerNeed, built, roads};
}

/* ---------- metrics for achievements ---------- */
function computeMetrics(){
  const S=G.S, st=S.stats, b=S.city.b.filter(x=>x.done!==false);
  const count = f => b.filter(x=>{const d=BMAP[x.id]; return d && f(d);}).length;
  const mutual = friendsList().length;
  return {
    sessions:st.sessions, totalMin:st.totalMin, earlySessions:st.early, nightSessions:st.night, longSessions45:st.long45,
    longestSession:st.longest, topicsDone:st.topicsDone, subjectsStudied:(st.subjectsStudied||[]).length, tasksDone:st.tasksDone,
    bestStreak:Math.max(S.bestStreak, currentStreak()), studyDays30:consistency(30).days, comebacks:st.comebacks,
    promotions:st.promotions, top3Weeks:st.top3Weeks, weekWins:st.weekWins, duelsWon:st.duelsWon,
    friends:mutual, challengesDone:st.challengesDone, challengesSent:st.challengesSent, reactionsGiven:st.reactionsGiven,
    houses:count(d=>d.c==='res'), farms:count(d=>d.c==='agr'), roads:count(d=>d.id==='road'), th:S.city.th,
    buildings:count(d=>d.c!=='dec' && d.id!=='road' && d.id!=='rail'), industry:count(d=>d.c==='ind'),
    population:cityStats(S.city).population, level:lvl(), chestsOpened:st.chestsOpened,
  };
}
function allBadges(){ return BADGES.concat((G.config.badges||[]).filter(b=>b && b.id && b.metric && b.t)); }

/* ---------- rewards ---------- */
const pendingFx=[];  // floating reward chips
function grant(r, why){
  if(!r) return [];
  const S=G.S, out=[];
  const lv0=lvl();
  if(r.xp){ S.xp+=r.xp; dayRec().xp+=r.xp; out.push(`+${fmtNum(r.xp)} XP`); }
  if(r.coins){ S.coins+=r.coins; dayRec().coins+=r.coins; out.push(`+${fmtNum(r.coins)} coins`); }
  if(r.mat){ S.mat+=r.mat; out.push(`+${r.mat} materials`); }
  if(r.chest){ S.chests[r.chest]=(S.chests[r.chest]||0)+1; out.push(`${CHESTS[r.chest].i} ${CHESTS[r.chest].n}`); }
  if(r.decor){ S.inv[r.decor]=(S.inv[r.decor]||0)+1; out.push(`${BMAP[r.decor].i} ${BMAP[r.decor].n}`); }
  if(r.boost){ S.boost=r.boost; out.push(`×${r.boost.mult} XP boost for ${r.boost.min} min`); }
  const lv1=lvl();
  if(lv1>lv0){ pushFeed('level',`reached Level ${lv1}`); toast(`⭐ LEVEL UP — Level ${lv1}`,'big'); checkUnlockNotice(lv0, lv1); }
  if(why && out.length) toast(`${why}: ${out.join(' · ')}`, 'reward');
  return out;
}
function checkUnlockNotice(lv0, lv1){
  const th=G.S.city.th; const nx=TOWNHALL[th+1];
  if(nx && lv0<nx.lvl && lv1>=nx.lvl) toast(`🏛️ Town Hall ${th+1} is now within reach`, 'info');
}
function pushFeed(type, text){
  const f=G.S.social.feed; f.unshift({id:uid8(), t:Date.now(), type, text}); if(f.length>25) f.length=25;
}

function checkBadges(silent){
  const m=computeMetrics(); const got=[];
  allBadges().forEach(b=>{
    if(G.S.badges[b.id]) return;
    if((m[b.metric]||0) >= b.t){ G.S.badges[b.id]=Date.now(); got.push(b); }
  });
  got.forEach(b=>{ grant(b.r); pushFeed('badge',`unlocked “${b.n}”`); if(!silent) toast(`🏆 BADGE UNLOCKED — ${b.i} ${b.n}`,'big'); });
  return got;
}
function checkStreakRewards(){
  const run=streakRunId(), cur=currentStreak(); const sc=G.S.streakClaims;
  if(sc.run!==run){ sc.run=run; sc.got=[]; }
  G.S.bestStreak=Math.max(G.S.bestStreak, cur);
  const out=[];
  STREAK_REWARDS.forEach(r=>{ if(cur>=r.d && !sc.got.includes(r.d)){ sc.got.push(r.d); out.push(r); grant({coins:r.coins, chest:r.chest, mat:r.mat}); if(r.d>=3) pushFeed('streak',`hit a ${r.d}-day streak`); } });
  return out;
}

/* ---------- Town hall & construction ---------- */
function thNext(){ const th=G.S.city.th; return th>=TH_MAX ? null : Object.assign({level:th+1}, TOWNHALL[th+1]); }
function thProgress(){
  const n=thNext(); if(!n) return 1;
  const needXp = LEVEL_CUM[n.lvl] || 0;
  const a = needXp ? Math.min(1, G.S.xp/needXp) : 1;
  const b = n.coins ? Math.min(1, G.S.coins/n.coins) : 1;
  const c = n.mat ? Math.min(1, G.S.mat/n.mat) : 1;
  return (a+b+c)/3;
}
function canUpgradeTH(){ const n=thNext(); return !!n && lvl()>=n.lvl && G.S.coins>=n.coins && G.S.mat>=n.mat; }
function upgradeTH(){
  if(!canUpgradeTH()) return false; const n=thNext();
  G.S.coins-=n.coins; G.S.mat-=n.mat; G.S.city.th=n.level; dayRec().builds++;
  pushFeed('th',`upgraded Town Hall to Level ${n.level} — ${n.name}`);
  toast(`🏛️ TOWN HALL LEVEL ${n.level} — ${n.name}`,'big');
  const unl=BUILDINGS.filter(b=>b.th===n.level && b.cost); if(unl.length) toast(`🏗️ New buildings: ${unl.map(b=>b.i+' '+b.n).join(', ')}`,'info');
  checkBadges(); save(); return true;
}
function activeBuilds(){ return G.S.city.b.filter(x=>x.done===false); }
function nextUnlock(){
  const th=G.S.city.th;
  const cand=BUILDINGS.filter(b=>b.cost && b.th>th).sort((a,b)=>a.th-b.th||a.cost-b.cost)[0];
  return cand ? {b:cand, pct:Math.round(thProgress()*100)} : null;
}
function canAfford(d){ return G.S.coins>=d.cost && G.S.mat>=d.mat; }
function placeBuilding(id, x, z, r, fromInv, u){
  const d=BMAP[id]; const S=G.S;
  if(!d) return 'Unknown building';
  if(d.th>S.city.th) return `Needs Town Hall ${d.th}`;
  const isFirstRes = !fromInv && d.c==='res' && !S.city.b.some(q=>BMAP[q.id]&&BMAP[q.id].c==='res');
  if(!fromInv && !isFirstRes){ if(!d.cost) return 'Only available from chests'; if(!canAfford(d)) return 'Not enough coins or materials'; }
  if(d.min>0 && !isFirstRes && activeBuilds().length>=buildSlotsFor(S.city.th)) return `All ${buildSlotsFor(S.city.th)} construction slots are busy. Study to finish them.`;
  if(!tileFree(S.city, x, z, d.w, d.d, r)) return 'That spot is taken';
  const firstHouse = !fromInv && d.c==='res' && !S.city.b.some(q=>BMAP[q.id]&&BMAP[q.id].c==='res');
  if(fromInv){ if(!(S.inv[id]>0)) return 'None in inventory'; S.inv[id]--; }
  else if(!firstHouse){ S.coins-=d.cost; S.mat-=d.mat; }
  const instant = d.min===0 || firstHouse;
  S.city.b.push({u:u||uid8(), id, x, z, r:r||0, done: instant ? true : false, prog:0, at:Date.now()});
  dayRec().builds++;
  if(firstHouse) toast('🏠 Your first house is built instantly. Your civilization has begun.','big');
  else if(!instant) toast(`🏗️ ${d.n} is under construction — ${d.min} study minutes to finish`,'info');
  checkBadges(); save(); return null;
}
function footprint(w,d,r){ return (r%2) ? [d,w] : [w,d]; }
function tileFree(city, x, z, w, d, r, ignoreU){
  const n=gridSizeFor(city.th); const [fw,fd]=footprint(w,d,r||0);
  if(x<0||z<0||x+fw>n||z+fd>n) return false;
  const c=Math.floor(n/2)-1; // town hall occupies c..c+1
  if(x < c+2 && x+fw > c && z < c+2 && z+fd > c) return false;
  for(const b of city.b){ if(b.u===ignoreU) continue; const bd=BMAP[b.id]; if(!bd) continue; const [bw,bdd]=footprint(bd.w,bd.d,b.r||0);
    if(x < b.x+bw && x+fw > b.x && z < b.z+bdd && z+fd > b.z) return false; }
  return true;
}
function moveBuilding(u, x, z, r){
  const b=G.S.city.b.find(q=>q.u===u); if(!b) return 'Missing';
  const d=BMAP[b.id]; if(!tileFree(G.S.city,x,z,d.w,d.d,r,u)) return 'That spot is taken';
  b.x=x; b.z=z; b.r=r; save(); return null;
}
function removeBuilding(u){
  const i=G.S.city.b.findIndex(q=>q.u===u); if(i<0) return;
  const b=G.S.city.b[i], d=BMAP[b.id];
  if(d.cost){ const refund=Math.floor(d.cost*0.5); G.S.coins+=refund; toast(`Removed ${d.n}. Refunded ${refund} coins.`,'info'); }
  else { G.S.inv[b.id]=(G.S.inv[b.id]||0)+1; toast(`${d.n} returned to your inventory.`,'info'); }
  G.S.city.b.splice(i,1); save();
}

/* ---------- chests ---------- */
function openChest(kind){
  const S=G.S; if(!(S.chests[kind]>0)) return null;
  S.chests[kind]--; S.stats.chestsOpened++;
  const t=CHESTS[kind].table; let roll=Math.random()*100, row=t[t.length-1];
  for(const r of t){ if(roll<r[0]){ row=r; break; } roll-=r[0]; }
  const rnd=(a,b)=>Math.round(a+Math.random()*(b-a));
  let r={};
  if(row[1]==='coins') r={coins:rnd(row[2],row[3])};
  else if(row[1]==='xp') r={xp:rnd(row[2],row[3])};
  else if(row[1]==='mat') r={mat:rnd(row[2],row[3])};
  else if(row[1]==='boost') r={boost:{mult:row[2], min:row[3]}};
  else if(row[1]==='decor'){ const pool=DECOR_POOL[row[2]]; r={decor:pool[Math.floor(Math.random()*pool.length)]}; }
  const lines=grant(r);
  checkBadges(); save();
  return {kind, lines, r};
}

/* ---------- quests ---------- */
function dailyQuests(k=dayKey()){
  const rnd=seeded(G.uid+'|'+k); const S=G.S;
  const time = S.goalMin>=60 ? 'min60' : S.goalMin>=30 ? 'min30' : 'min15';
  const pool=DAILY_POOL.filter(q=>q.kind!=='minutes');
  const picks=[DAILY_POOL.find(q=>q.id===time)];
  while(picks.length<4){ const q=pool[Math.floor(rnd()*pool.length)]; if(!picks.includes(q)) picks.push(q); }
  return picks.map(q=>Object.assign({}, q, questProgress(q, k)));
}
function scheduleFor(k){
  const dw=dowOf(k);
  return G.S.schedule.filter(e => e.date ? e.date===k : (e.days||[]).includes(dw));
}
function questProgress(q, k){
  const d=G.S.daily[k]||emptyDay(); let cur=0;
  switch(q.kind){
    case 'minutes': cur=d.min; break; case 'sessions': cur=d.n; break; case 'tasks': cur=d.tasks; break;
    case 'topics': cur=d.topics; break; case 'subjects': cur=Object.keys(d.subj).length; break;
    case 'focus': cur=d.focus>=q.v?q.v:0; break; case 'streakday': cur=d.min>=ECON.studyDayMin?1:0; break;
    case 'schedule': { const sc=scheduleFor(k); cur = sc.length && sc.every(e=>d.sched.includes(e.id)) ? 1 : 0; break; }
    case 'reactions': cur=d.react; break; case 'builds': cur=d.builds; break;
  }
  const claimed=(d.quests||[]).includes(q.id);
  return {cur:Math.min(cur,q.v), done:cur>=q.v, claimed};
}
function claimQuest(id){
  const k=dayKey(); const q=dailyQuests(k).find(x=>x.id===id); if(!q||!q.done||q.claimed) return;
  dayRec(k).quests.push(id); grant(q.r, `${q.i} Quest complete`); checkCombo(); checkBadges(); save();
}
function weeklyQuests(){
  const wk=weekKey(); const a=weekAgg(); const days=weekDays();
  const claimedQ = days.reduce((s,k)=>s+((G.S.daily[k]&&G.S.daily[k].quests||[]).length),0);
  const chal = days.reduce((s,k)=>s+((G.S.daily[k]&&G.S.daily[k].chal)||0),0);
  const got=G.S.weeklyClaimed[wk]||[];
  return WEEKLY_POOL.map(q=>{ let cur=0;
    if(q.kind==='minutes') cur=a.min; else if(q.kind==='tasks') cur=a.tasks; else if(q.kind==='days') cur=a.days;
    else if(q.kind==='challenges') cur=chal; else if(q.kind==='quests') cur=claimedQ;
    return Object.assign({}, q, {cur:Math.min(cur,q.v), done:cur>=q.v, claimed:got.includes(q.id)}); });
}
function claimWeekly(id){
  const wk=weekKey(); const q=weeklyQuests().find(x=>x.id===id); if(!q||!q.done||q.claimed) return;
  (G.S.weeklyClaimed[wk]=G.S.weeklyClaimed[wk]||[]).push(id);
  grant(q.r, `${q.i} Weekly mission`); checkBadges(); save();
}
function claimableCount(){ return dailyQuests().filter(q=>q.done&&!q.claimed).length + weeklyQuests().filter(q=>q.done&&!q.claimed).length; }

/* ---------- combo boost ---------- */
function comboState(){
  const d=today();
  const own = d.tasks>0 || dailyQuests().some(q=>q.claimed);
  const friend = (d.chal||0)>0;
  return {own, friend, active: own && friend, claimed: !!d.combo};
}
function checkCombo(){
  const c=comboState(); if(c.active && !c.claimed){ dayRec().combo=1; grant({coins:50, chest:'wooden'}, '⚡ COMBO BONUS'); toast('⚡ Combo active: +20% XP for the rest of today','big'); }
}

/* ---------- study sessions ---------- */
function startSession(o){
  if(G.S.active) return;
  G.S.active = {id:o.id||uid8(), subjectId:o.subjectId||null, topicId:o.topicId||null, mode:o.mode||'stopwatch', targetMin:o.targetMin||0, schedId:o.schedId||null, startedAt:nowMs(), pausedMs:0, pausedAt:null};
  save(true);
}
function pauseSession(){ const a=G.S.active; if(!a||a.pausedAt) return; a.pausedAt=nowMs(); save(true); }
function resumeSession(){ const a=G.S.active; if(!a||!a.pausedAt) return; a.pausedMs+=nowMs()-a.pausedAt; a.pausedAt=null; save(true); }
function elapsedSec(a=G.S.active){ if(!a) return 0; const end=a.pausedAt||nowMs(); return Math.max(0,(end-a.startedAt-a.pausedMs)/1000); }
function cancelSession(){ G.S.active=null; save(true); }
function sessionPreview(min){
  let xp=0, coins=0, mat=0; const hit=[];
  MILESTONES.forEach(m=>{ if(min>=m.m){ xp+=m.xp||0; coins+=m.coins||0; mat+=m.mat||0; hit.push(m); } });
  xp+=Math.floor(min)*ECON.xpPerMin; coins+=Math.floor(min)*ECON.coinPerMin;
  return {xp, coins, mat, hit, next:MILESTONES.find(m=>m.m>min)};
}
/** Finish the active session. overrideMin lets the player shorten (never lengthen) the recorded time. */
function finishSession(overrideMin){
  const S=G.S, a=S.active; if(!a) return null;
  const now=nowMs();
  let startTs = a.startedAt;
  // validation: no overlap with the previous session
  if(S.lastSessionEnd && startTs < S.lastSessionEnd) startTs = S.lastSessionEnd;
  const wallMin = Math.max(0,(Math.min(now, a.pausedAt||now) - startTs - a.pausedMs)/60000);
  let min = wallMin;
  if(a.mode==='countdown' && a.targetMin) min = Math.min(min, a.targetMin);
  if(typeof overrideMin==='number' && overrideMin>=0) min = Math.min(min, overrideMin);
  min = Math.min(min, ECON.maxSessionMin);
  const td = dayRec();
  const allowed = Math.max(0, ECON.maxDailyMin - td.min);
  const counted = Math.floor(Math.min(min, allowed));
  S.active=null;
  if(counted < ECON.minSessionMin){ save(true); return {discarded:true, min:Math.floor(min), capped: allowed<ECON.minSessionMin}; }

  const before = {xp:S.xp, lvl:lvl(), streak:currentStreak(), thp:thProgress(), chestMin:S.chestMin, builds: activeBuilds().map(b=>({u:b.u,prog:b.prog}))};
  const wasStudyDayToday = isStudyDay(dayKey());
  const gapDays = (()=>{ let k=addDays(dayKey(),-1), n=0; while(n<30 && !isStudyDay(k)){ n++; k=addDays(k,-1);} return n; })();

  // --- base & milestones
  const pv = sessionPreview(counted);
  let xp = pv.xp, coins = pv.coins, mat = pv.mat;
  const focusDone = a.mode==='countdown' && a.targetMin && counted >= a.targetMin - 0.5;
  // record the day first so streak bonus includes today
  td.min += counted; td.n += 1;
  const sub = S.subjects.find(s=>s.id===a.subjectId);
  const subKey = sub ? sub.id : '_general';
  td.subj[subKey] = (td.subj[subKey]||0) + counted;
  const h = localHour(startTs); td.hours[h]=(td.hours[h]||0)+counted;
  if(counted>=45) td.long45++;
  if(focusDone) td.focus = Math.max(td.focus, a.targetMin);
  if(a.schedId && !td.sched.includes(a.schedId)){ const e=S.schedule.find(x=>x.id===a.schedId); if(e){ const plan=schedMinutes(e); if(counted >= plan*0.8) td.sched.push(a.schedId); } }
  const streakNow = currentStreak();
  // --- multipliers
  const mults=[];
  const sb = Math.min(ECON.streakBonusCap, streakNow*ECON.streakBonusPerDay); if(sb>0) mults.push(['Streak', sb]);
  if(focusDone) mults.push(['Focus', ECON.focusBonus]);
  if(td.combo) mults.push(['Combo', ECON.comboXpBonus]);
  let mult = 1 + mults.reduce((s,m)=>s+m[1],0);
  let boostXp = 0;
  if(S.boost && S.boost.min>0){ const bm=Math.min(S.boost.min, counted); boostXp = Math.round(bm*ECON.xpPerMin*(S.boost.mult-1)); S.boost.min-=bm; if(S.boost.min<=0) S.boost=null; }
  xp = Math.round(xp*mult) + boostXp;
  // --- stats
  const st=S.stats; st.sessions++; st.totalMin+=counted; st.longest=Math.max(st.longest,counted);
  if(h<7 && h>=4) st.early++; if(h>=22 || h<3) st.night++; if(counted>=45) st.long45++;
  if(sub && !(st.subjectsStudied||[]).includes(sub.id)) (st.subjectsStudied=st.subjectsStudied||[]).push(sub.id);
  if(!wasStudyDayToday && td.min>=ECON.studyDayMin && gapDays>=3 && st.sessions>1) st.comebacks++;
  // --- chest progress
  S.chestMin += counted; const chestsGot=[];
  while(S.chestMin >= ECON.chestEveryMin){ S.chestMin-=ECON.chestEveryMin; S.chestEarned++; const k = S.chestEarned%5===0 ? 'silver':'wooden'; S.chests[k]++; chestsGot.push(k); }
  // --- construction
  const finished=[];
  activeBuilds().forEach(b=>{ const d=BMAP[b.id]; b.prog = Math.min(d.min, (b.prog||0)+counted); if(b.prog>=d.min){ b.done=true; finished.push(d); pushFeed('build',`finished building ${d.i} ${d.n}`); } });
  // --- challenges
  const chDone = progressChallenges(counted, sub ? sub.name : '');
  // --- grant
  S.xp += xp; S.coins += coins; S.mat += mat; td.xp += xp; td.coins += coins;
  S.lastSessionEnd = now;
  const lvAfter=lvl();
  if(lvAfter>before.lvl){ pushFeed('level',`reached Level ${lvAfter}`); }
  const streakRew = checkStreakRewards();
  if(counted>=25) pushFeed('session',`completed a ${fmtMin(counted)} study session${sub? ' in '+sub.name:''}`);
  const badges = checkBadges(true);
  // --- log
  const rec={id:a.id, st:startTs, en:now, min:counted, sub:sub?sub.name:'General', sid:subKey, top:a.topicId||null, xp, c:coins, mode:a.mode};
  save(true);
  // --- achievement closest to done
  const m=computeMetrics();
  const near = allBadges().filter(b=>!S.badges[b.id]).map(b=>({b, p:Math.min(1,(m[b.metric]||0)/b.t)})).sort((x,y)=>y.p-x.p)[0];
  return {
    discarded:false, log:rec, min:counted, wallMin:Math.floor(wallMin), sub:sub?sub.name:'General study', xp, coins, mat, mults, boostXp, milestones:pv.hit,
    streak:streakNow, streakUp: !wasStudyDayToday && isStudyDay(dayKey()), streakRew,
    lvl0:before.lvl, lvl1:lvAfter, civ: Math.max(0,(thProgress()-before.thp)*100),
    chestPct: Math.round(counted/ECON.chestEveryMin*100), chestsGot, finished, badges, chDone,
    buildProg: activeBuilds().map(b=>({d:BMAP[b.id], pct:Math.round(b.prog/BMAP[b.id].min*100)})),
    near: near ? {n:near.b.n, i:near.b.i, pct:Math.round(near.p*100)} : null,
    capped: counted < Math.floor(min),
  };
}
function schedMinutes(e){ const [a,b]=[e.start,e.end].map(t=>{const[h,m]=t.split(':').map(Number); return h*60+m;}); return Math.max(5, b-a); }

/* ---------- subjects / tasks ---------- */
function addSubject(name, id){ name=name.trim(); if(!name) return; const col=SUBJECT_COLS[G.S.subjects.length%SUBJECT_COLS.length]; const s={id:id||uid8(), name, col, topics:[]}; G.S.subjects.push(s); save(); return s; }
function addTopic(sid, name, id){ const s=G.S.subjects.find(x=>x.id===sid); name=name.trim(); if(!s||!name) return; s.topics.push({id:id||uid8(), name, done:false}); save(); }
function toggleTopic(sid, tid){
  const s=G.S.subjects.find(x=>x.id===sid); const t=s&&s.topics.find(x=>x.id===tid); if(!t) return;
  t.done=!t.done; const d=dayRec();
  if(t.done){ t.doneAt=Date.now(); d.topics++; G.S.stats.topicsDone++; grant({xp:25, coins:5}, `✅ ${t.name}`); }
  else { d.topics=Math.max(0,d.topics-1); G.S.stats.topicsDone=Math.max(0,G.S.stats.topicsDone-1); G.S.xp=Math.max(0,G.S.xp-25); G.S.coins=Math.max(0,G.S.coins-5); }
  checkBadges(); save();
}
function addTask(o){ const t={id:o.id||uid8(), title:o.title.trim(), subjectId:o.subjectId||null, date:o.date||dayKey(), kind:o.kind||'task', done:false, createdAt:Date.now()}; if(!t.title) return; G.S.tasks.push(t); save(); }
function toggleTask(id){
  const t=G.S.tasks.find(x=>x.id===id); if(!t) return; t.done=!t.done;
  const k = t.done ? dayKey() : (t.doneDay||dayKey()); const d=dayRec(k);
  const r = t.kind==='assignment' ? {xp:40,coins:10} : t.kind==='goal' ? {xp:60,coins:15} : {xp:20,coins:5};
  if(t.done){ t.doneAt=Date.now(); t.doneDay=dayKey(); d.tasks++; G.S.stats.tasksDone++; grant(r, `📝 ${t.title}`); checkCombo(); }
  else { d.tasks=Math.max(0,d.tasks-1); G.S.stats.tasksDone=Math.max(0,G.S.stats.tasksDone-1); G.S.xp=Math.max(0,G.S.xp-r.xp); G.S.coins=Math.max(0,G.S.coins-r.coins); }
  checkBadges(); save();
}

/* ---------- social ---------- */
function P(uid){ return G.players[uid]; }
function isDemo(uid){ const p=P(uid); return !!(p && p.demo); }
function theyListMe(uid){ const p=P(uid); if(!p) return false; if(p.demo) return G.S.social.friends.includes(uid); return (p.friends||[]).includes(G.uid); }
function friendsList(){ return G.S.social.friends.filter(u=>P(u) && theyListMe(u)); }
function incomingRequests(){ return Object.keys(G.players).filter(u=>u!==G.uid && !P(u).demo && (P(u).friends||[]).includes(G.uid) && !G.S.social.friends.includes(u) && !G.S.social.declined.includes(u)); }
function outgoingRequests(){ return G.S.social.friends.filter(u=>P(u) && !theyListMe(u)); }
function addFriend(u){ const s=G.S.social; if(u===G.uid||s.friends.includes(u)) return; s.friends.push(u); s.declined=s.declined.filter(x=>x!==u); if(theyListMe(u)){ toast(`🤝 You and ${P(u).displayName} are now friends`,'reward'); pushFeed('friend',`became friends with ${P(u).displayName}`);} else toast('Friend request sent','info'); checkBadges(); save(); }
function declineFriend(u){ const s=G.S.social; if(!s.declined.includes(u)) s.declined.push(u); s.friends=s.friends.filter(x=>x!==u); save(); }
function removeFriend(u){ declineFriend(u); toast('Friend removed','info'); }

/* challenges */
function challengeReward(c){ return {xp:c.min*3, coins:c.min, fcp:1}; }
function allChallenges(){ // {c, from, role}
  const out=[];
  G.S.social.chOut.forEach(c=>out.push({c, from:G.uid, role:'sender'}));
  friendsList().forEach(u=>{ (P(u).chOut||[]).forEach(c=>{ if(c.to===G.uid || (P(u).demo && c.to==='*')) out.push({c, from:u, role:'receiver'}); }); });
  return out;
}
function chExpired(c){ return c.deadline && dayKey() > c.deadline; }
function partnerOf(x){ return x.role==='sender' ? x.c.to : x.from; }
function partnerState(x){ const p=P(partnerOf(x)); return p && p.chState ? p.chState[x.c.id] : null; }
function sendChallenge(o){
  const c={id:o.id||uid8(), to:o.to, subj:(o.subj||'').trim(), min:clamp(parseInt(o.min)||30,10,240), type:o.type||'solo', deadline:o.deadline||addDays(dayKey(),2), at:Date.now(), msg:(o.msg||'').trim().slice(0,80)};
  const s=G.S.social; s.chOut.unshift(c); if(s.chOut.length>30) s.chOut.length=30;
  if(c.type!=='solo') s.chState[c.id]={s:'accepted', at:Date.now(), prog:0};
  G.S.stats.challengesSent++; toast(`🎯 Challenge sent to ${P(c.to)?P(c.to).displayName:'friend'}`,'info'); checkBadges(); save();
}
function respondChallenge(id, accept){
  G.S.social.chState[id] = accept ? {s:'accepted', at:Date.now(), prog:0} : {s:'declined', at:Date.now()};
  save(); if(accept) toast('Challenge accepted. Study to complete it.','info');
}
function progressChallenges(min, subjName){
  const done=[];
  allChallenges().forEach(x=>{
    const cs=G.S.social.chState[x.c.id]; if(!cs || cs.s!=='accepted' || chExpired(x.c)) return;
    if(x.c.subj && !(subjName||'').toLowerCase().includes(x.c.subj.toLowerCase())) return;
    cs.prog=(cs.prog||0)+min;
    const r=resolveChallenge(x); if(r) done.push(r);
  });
  return done;
}
function resolveChallenge(x){
  const cs=G.S.social.chState[x.c.id]; if(!cs || cs.s!=='accepted') return null;
  const ps=partnerState(x);
  let complete=false, won=false;
  if(x.c.type==='team'){ complete = (cs.prog||0) + ((ps&&ps.prog)||0) >= x.c.min; }
  else { complete = (cs.prog||0) >= x.c.min; if(x.c.type==='duel' && complete) won = !(ps && ps.s==='done'); }
  if(!complete) return null;
  cs.s='done'; cs.doneAt=Date.now(); cs.won=won;
  const r=challengeReward(x.c); const st=G.S.stats; st.challengesDone++; st.fcp+=1; if(won) st.duelsWon++;
  dayRec().chal=(dayRec().chal||0)+1;
  grant({xp:r.xp, coins:r.coins + (won?50:0)}, `🎯 Challenge complete${won?' — you won the duel':''}`);
  const other=P(partnerOf(x)); pushFeed('challenge',`completed a friend challenge${other?' with '+other.displayName:''}`);
  checkCombo();
  return {c:x.c, won};
}
function syncTeamChallenges(){ // a partner's progress can complete a team challenge without me studying
  let changed=false; allChallenges().forEach(x=>{ if(x.c.type==='team' && !chExpired(x.c) && resolveChallenge(x)) changed=true; });
  if(changed){ checkBadges(); save(); }
}
function toggleReaction(owner, evId, emoji){
  const key=owner+'|'+evId; const r=G.S.social.reactions;
  if(r[key]===emoji) delete r[key]; else { if(!r[key]){ G.S.stats.reactionsGiven++; dayRec().react++; } r[key]=emoji; }
  const keys=Object.keys(r); if(keys.length>120) delete r[keys[0]];
  checkBadges(); save();
}
function reactionsFor(owner, evId){
  const key=owner+'|'+evId; const counts={}; let mine=null;
  Object.entries(G.players).forEach(([u,p])=>{ const e=(u===G.uid? G.S.social.reactions : p.reactions||{})[key]; if(e){ counts[e]=(counts[e]||0)+1; if(u===G.uid) mine=e; } });
  return {counts, mine};
}

/* ---------- demo player simulation (so the league feels alive) ---------- */
function demoWeek(p){
  const wd=(tzNow().getUTCDay()+6)%7, frac=(wd + localHour()/24)/7;
  const xp=Math.round(p.demoRate*7*frac*(0.9+seeded(p.username+weekKey())()*0.2));
  return {key:weekKey(), xp, min:Math.round(xp/6), tasks:Math.round(xp/180), days:Math.min(7,wd+1)};
}
function playerWeek(p){ if(!p) return {xp:0,min:0,tasks:0,days:0}; if(p.demo) return demoWeek(p); return (p.week && p.week.key===weekKey()) ? p.week : {xp:0,min:0,tasks:0,days:0}; }
function playerToday(p){ if(!p) return 0; if(p.demo){ const h=localHour(); return Math.round(p.demoRate/6 * clamp((h-7)/14,0,1)); } return (p.today && p.today.key===dayKey()) ? p.today.min : 0; }

/* ---------- league ---------- */
function leagueBoard(tier){
  return Object.entries(G.players).filter(([u,p])=>p.displayName && (tier===undefined || (p.league||0)===tier))
    .map(([u,p])=>({u, p, w:playerWeek(p), last: p.lastWeek&&p.lastWeek.xp||p.demoLast||0}))
    .sort((a,b)=>b.w.xp-a.w.xp);
}
function myRank(){ const b=leagueBoard(G.S.league.tier); const i=b.findIndex(x=>x.u===G.uid); return i<0? null : i+1; }
function processLeagueRollover(){
  const L=G.S.league, wk=weekKey(); if(L.lastWk===wk) return;
  const prevWkDate=prevWeekDate();
  const prevKey=weekKey(prevWkDate); const agg=weekAgg(prevWkDate);
  // rank among players who recorded that week
  const others=Object.values(G.players).filter(p=>!p._me && (p.league||0)===L.tier).map(p=> p.week&&p.week.key===prevKey ? p.week.xp : (p.lastWeek&&p.lastWeek.key===prevKey? p.lastWeek.xp : (p.demo? p.demoRate*7 : 0)));
  const rank = 1 + others.filter(x=>x>agg.xp).length;
  let res='stay';
  if(agg.xp>=LEAGUES[L.tier].promo || (rank<=3 && agg.xp>=300)){ if(L.tier<LEAGUES.length-1){ L.tier++; res='up'; G.S.stats.promotions++; } }
  else if(agg.xp<100 && L.tier>0){ L.tier--; res='down'; }
  if(agg.xp>0){ if(rank<=3) G.S.stats.top3Weeks++; if(rank===1) G.S.stats.weekWins++; }
  if(agg.xp>0 && rank<=3) grant({coins:[150,100,60][rank-1], chest: rank===1?'gold':'silver'});
  L.hist.unshift({wk:prevKey, tier:L.tier, xp:agg.xp, rank, res}); if(L.hist.length>26) L.hist.length=26;
  L.lastWk=wk; checkBadges(true); save();
}

/* ---------- public projection ---------- */
function buildPublic(){
  const S=G.S, pr=S.privacy, w=weekAgg(), d=today();
  const prevWk=prevWeekDate();
  const cs=cityStats(S.city);
  return {
    v:APP_VERSION, username:S.profile.username, displayName:S.profile.displayName, avatar:S.profile.avatar, avatarCol:S.profile.avatarCol, playerId:S.profile.playerId,
    xp:S.xp, level:lvl(), th:S.city.th, league:S.league.tier, streak:currentStreak(), bestStreak:Math.max(S.bestStreak,currentStreak()),
    badges:Object.keys(S.badges), badgeCount:Object.keys(S.badges).length,
    today: pr.today ? {key:dayKey(), min:d.min, xp:d.xp} : {key:dayKey(), min:null},
    week:{key:weekKey(), xp:w.xp, min:w.min, tasks:w.tasks, days:w.days},
    lastWeek:{key:weekKey(prevWk), xp:weekAgg(prevWk).xp},
    stats: pr.stats ? {totalMin:S.stats.totalMin, sessions:S.stats.sessions, tasksDone:S.stats.tasksDone, consistency:consistency(30).pct, challengesDone:S.stats.challengesDone} : null,
    city: pr.city ? {th:S.city.th, b:S.city.b.map(b=>[b.id,b.x,b.z,b.r||0,b.done===false?0:1]), flag:S.city.flag, pop:cs.population} : {th:S.city.th, hidden:true, pop:cs.population},
    friends:S.social.friends, declined:S.social.declined, chOut:S.social.chOut, chState:S.social.chState,
    feed:S.social.feed.slice(0,20), reactions:S.social.reactions,
    studying: (pr.studying && S.active && !S.active.pausedAt) ? {since:S.active.startedAt, subj:(S.subjects.find(s=>s.id===S.active.subjectId)||{}).name||'General'} : null,
    updatedAt:Date.now(),
  };
}

/* ---------- notifications (derived) ---------- */
function notifications(){
  const S=G.S, N=S.notif, out=[], now=tzNow();
  if(N.friend) incomingRequests().forEach(u=>out.push({i:'🤝', t:`${P(u).displayName} sent you a friend request`, go:'friends', act:1}));
  if(N.challenge) allChallenges().filter(x=>x.role==='receiver' && !S.social.chState[x.c.id] && !chExpired(x.c)).forEach(x=>out.push({i:'🎯', t:`${P(x.from).displayName} challenged you: study ${x.c.subj||'anything'} for ${x.c.min} min`, go:'friends', act:1}));
  if(N.challenge) S.social.chOut.forEach(c=>{ const p=P(c.to); const st=p&&p.chState&&p.chState[c.id]; if(st && st.s==='done' && st.doneAt>Date.now()-86400000*2) out.push({i:'✅', t:`${p.displayName} completed your challenge`, go:'friends', ts:st.doneAt}); });
  if(N.quest){ const c=claimableCount(); if(c) out.push({i:'📜', t:`${c} quest reward${c>1?'s':''} ready to claim`, go:'rewards', act:1}); }
  if(N.chest){ const c=Object.values(S.chests).reduce((a,b)=>a+b,0); if(c) out.push({i:'🎁', t:`${c} chest${c>1?'s':''} waiting to be opened`, go:'rewards', act:1}); }
  if(N.streak && currentStreak()>0 && !isStudyDay(dayKey()) && now.getUTCHours()>=17) out.push({i:'🔥', t:`Study ${ECON.studyDayMin} minutes today to keep your ${currentStreak()}-day streak`, go:'study', act:1});
  if(N.build && canUpgradeTH()) out.push({i:'🏛️', t:`Town Hall ${S.city.th+1} upgrade is ready`, go:'world', act:1});
  if(N.sched){ const mins=now.getUTCHours()*60+now.getUTCMinutes(); scheduleFor(dayKey()).forEach(e=>{ const [h,m]=e.start.split(':').map(Number); const st=h*60+m; if(st-mins<=30 && st-mins>=-schedMinutes(e) && !today().sched.includes(e.id)) out.push({i:'🗓️', t:`Scheduled: ${schedLabel(e)} at ${e.start}`, go:'schedule', act:1}); }); }
  if(N.league && S.league.hist[0] && S.league.seenWk!==S.league.hist[0].wk){ const h=S.league.hist[0]; out.push({i:'🏅', t:`Last week: rank #${h.rank} with ${fmtNum(h.xp)} XP${h.res==='up'?' — promoted to '+LEAGUES[h.tier].n:h.res==='down'?' — moved to '+LEAGUES[h.tier].n:''}`, go:'league', act:1}); }
  if(N.badge) Object.entries(S.badges).filter(([id,t])=>t>Date.now()-86400000).forEach(([id,t])=>{ const b=allBadges().find(x=>x.id===id); if(b) out.push({i:b.i, t:`Badge unlocked: ${b.n}`, go:'rewards', ts:t}); });
  if(N.friendAch) friendsList().forEach(u=>{ (P(u).feed||[]).filter(f=>(f.type==='badge'||f.type==='th') && (f.t||0)>Date.now()-86400000).slice(0,2).forEach(f=>out.push({i:'🌟', t:`${P(u).displayName} ${f.text}`, go:'friends', ts:f.t})); });
  if(G.config.announce) out.unshift({i:'📣', t:G.config.announce, go:'home'});
  return out;
}
function schedLabel(e){ const s=G.S.subjects.find(x=>x.id===e.subjectId); return e.title || (s? s.name : 'Study'); }

/* ============ Actions: the ONLY way state changes. Runs in the browser (preview) and on the server. ============ */
class GameError extends Error {}
const V = {
  str(v, max, min=0){ if(typeof v!=='string') v=''; v=v.replace(/[\u0000-\u001f]/g,'').trim(); if(v.length<min) throw new GameError('That text is too short'); return v.slice(0,max); },
  id(v){ if(typeof v==='string' && /^[A-Za-z0-9_-]{4,40}$/.test(v)) return v; return uid8(); },
  ref(v){ if(typeof v==='string' && /^[A-Za-z0-9_:-]{1,128}$/.test(v)) return v; throw new GameError('Invalid reference'); },
  int(v, a, b){ v=Math.round(Number(v)); if(!isFinite(v)) throw new GameError('Invalid number'); return clamp(v,a,b); },
  day(v){ if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v; return dayKey(); },
  time(v){ if(typeof v==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return v; throw new GameError('Invalid time'); },
  one(v, list, def){ return list.includes(v) ? v : def; },
  bool(v){ return !!v; },
  col(v, def){ return typeof v==='string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def; },
};
const needProfile = () => { if(!G.S.profile) throw new GameError('Create your profile first'); };
const LIMITS = {subjects:40, topics:80, tasks:400, schedule:120};

/* Actions marked auth:true use server time/randomness; the client waits for their result. */
const MUT = {
  register:{auth:true, fn(a){
    if(G.S.profile) throw new GameError('Profile already exists');
    const username=V.str(a.username,20).toLowerCase(); if(!/^[a-z0-9_]{3,20}$/.test(username)) throw new GameError('Username must be 3–20 letters, numbers or underscores');
    G.S.profile={displayName:V.str(a.displayName,24,1), username, avatar:V.one(a.avatar,AVATARS,'🦉'), avatarCol:V.col(a.avatarCol,'#58d0e8'), playerId:'WIYS-'+hashId(G.uid)};
    G.S.goalMin=V.int(a.goal||60,10,480); G.S.coins=100; G.S.onboard=1; G.S.createdAt=nowMs();
    (Array.isArray(a.subjects)?a.subjects:[]).slice(0,5).forEach(s=>{ const sub=addSubject(V.str(s.name,60), V.id(s.id)); if(sub) (Array.isArray(s.topics)?s.topics:[]).slice(0,20).forEach(t=>{ const n=V.str(t.name,60); if(n) sub.topics.push({id:V.id(t.id), name:n, done:false}); }); });
    pushFeed('friend','founded a new world');
    return {ok:true};
  }},
  setProfile:{fn(a){ needProfile(); const p=G.S.profile;
    if(a.displayName!==undefined) p.displayName=V.str(a.displayName,24,1);
    if(a.avatar!==undefined) p.avatar=V.one(a.avatar,AVATARS,p.avatar);
    if(a.avatarCol!==undefined) p.avatarCol=V.col(a.avatarCol,p.avatarCol);
    if(a.flag!==undefined) G.S.city.flag=V.col(a.flag,G.S.city.flag);
    if(a.goal!==undefined) G.S.goalMin=V.int(a.goal,10,480); }},
  setPref:{fn(a){ const g=V.one(a.group,['privacy','notif'],null); if(!g || !(a.key in G.S[g])) throw new GameError('Unknown setting'); G.S[g][a.key]=V.bool(a.value); }},
  setView:{fn(a){ const S=G.S;
    if(a.dayMode!==undefined) S.dayMode=V.one(a.dayMode,['real','cycle','day','night'],'real');
    if(a.weather!==undefined) S.weather=V.one(a.weather,['auto','sunny','cloudy','rain','storm','snow','fog'],'auto');
    if(a.gfx!==undefined) S.gfx=V.one(a.gfx,['auto','high','low','2d'],'auto');
    if(a.notifSeen) S.notifSeen=nowMs();
    if(a.leagueSeen && S.league.hist[0]) S.league.seenWk=S.league.hist[0].wk; }},
  // study structure
  addSubject:{fn(a){ needProfile(); if(G.S.subjects.length>=LIMITS.subjects) throw new GameError('Subject limit reached'); const n=V.str(a.name,60,1); if(G.S.subjects.some(s=>s.id===a.id)) return; addSubject(n, V.id(a.id)); }},
  delSubject:{fn(a){ G.S.subjects=G.S.subjects.filter(s=>s.id!==a.id); }},
  addTopic:{fn(a){ const s=G.S.subjects.find(x=>x.id===a.sid); if(!s) throw new GameError('Subject not found'); if(s.topics.length>=LIMITS.topics) throw new GameError('Topic limit reached'); addTopic(a.sid, V.str(a.name,60,1), V.id(a.id)); }},
  toggleTopic:{fn(a){ toggleTopic(a.sid, a.tid); }},
  delTopic:{fn(a){ const s=G.S.subjects.find(x=>x.id===a.sid); if(s) s.topics=s.topics.filter(t=>t.id!==a.tid); }},
  addTask:{fn(a){ needProfile(); if(G.S.tasks.length>=LIMITS.tasks){ G.S.tasks=G.S.tasks.filter(t=>!t.done || t.doneAt>nowMs()-60*86400000); if(G.S.tasks.length>=LIMITS.tasks) throw new GameError('Too many tasks — clear some done ones'); }
    addTask({id:V.id(a.id), title:V.str(a.title,90,1), kind:V.one(a.kind,['task','assignment','goal'],'task'), subjectId:G.S.subjects.some(s=>s.id===a.subjectId)?a.subjectId:null, date:V.day(a.date)}); }},
  toggleTask:{fn(a){ toggleTask(a.id); }},
  delTask:{fn(a){ G.S.tasks=G.S.tasks.filter(t=>t.id!==a.id); }},
  addSched:{fn(a){ needProfile(); const list=Array.isArray(a.entries)?a.entries.slice(0,7):[];
    list.forEach(e=>{ if(G.S.schedule.length>=LIMITS.schedule) throw new GameError('Schedule is full'); const start=V.time(e.start), end=V.time(e.end); if(end<=start) throw new GameError('End time must be after start time');
      const base={id:V.id(e.id), subjectId:G.S.subjects.some(s=>s.id===e.subjectId)?e.subjectId:null, title:V.str(e.title,40), start, end};
      if(Array.isArray(e.days)){ const days=[...new Set(e.days.map(d=>V.int(d,0,6)))]; if(!days.length) throw new GameError('Pick at least one day'); base.days=days; } else base.date=V.day(e.date);
      G.S.schedule.push(base); }); }},
  delSched:{fn(a){ G.S.schedule=G.S.schedule.filter(x=>x.id!==a.id); }},
  // sessions
  startSession:{fn(a){ needProfile(); if(G.S.active) throw new GameError('A session is already running');
    const mode=V.one(a.mode,['stopwatch','countdown'],'stopwatch');
    startSession({id:V.id(a.id), subjectId:G.S.subjects.some(s=>s.id===a.subjectId)?a.subjectId:null, topicId:typeof a.topicId==='string'?a.topicId.slice(0,40):null, mode, targetMin: mode==='countdown'? V.int(a.targetMin,5,ECON.maxSessionMin):0, schedId:G.S.schedule.some(s=>s.id===a.schedId)?a.schedId:null}); }},
  pauseSession:{fn(){ pauseSession(); }},
  resumeSession:{fn(){ resumeSession(); }},
  cancelSession:{fn(){ cancelSession(); }},
  finishSession:{auth:true, fn(a){ if(!G.S.active) throw new GameError('No session is running'); const o = a.overrideMin===undefined||a.overrideMin===null ? undefined : V.int(a.overrideMin,0,ECON.maxSessionMin); return finishSession(o); }},
  // rewards
  claimQuest:{fn(a){ claimQuest(a.id); }},
  claimWeekly:{fn(a){ claimWeekly(a.id); }},
  openChest:{auth:true, fn(a){ const k=V.one(a.kind,CHEST_ORDER,null); if(!k || !(G.S.chests[k]>0)) throw new GameError('No chest of that kind'); return openChest(k); }},
  // world
  placeBuilding:{fn(a){ needProfile(); if(!BMAP[a.id]) throw new GameError('Unknown building'); if(G.S.city.b.length>=1500) throw new GameError('Your city is full');
    const err=placeBuilding(a.id, V.int(a.x,0,60), V.int(a.z,0,60), V.int(a.r||0,0,3), !!a.inv, V.id(a.u)); if(err) throw new GameError(err); }},
  moveBuilding:{fn(a){ const err=moveBuilding(a.u, V.int(a.x,0,60), V.int(a.z,0,60), V.int(a.r||0,0,3)); if(err) throw new GameError(err); }},
  removeBuilding:{fn(a){ removeBuilding(a.u); }},
  upgradeTH:{fn(){ if(!upgradeTH()) throw new GameError('Town Hall requirements not met yet'); }},
  // social
  addFriend:{fn(a){ needProfile(); const u=V.ref(a.u); if(!P(u)) throw new GameError('Player not found'); if(G.S.social.friends.length>=300) throw new GameError('Friend limit reached'); addFriend(u); }},
  declineFriend:{fn(a){ declineFriend(V.ref(a.u)); }},
  removeFriend:{fn(a){ removeFriend(V.ref(a.u)); }},
  sendChallenge:{fn(a){ needProfile(); const to=V.ref(a.to); if(!friendsList().includes(to)) throw new GameError('You can only challenge friends');
    sendChallenge({id:V.id(a.id), to, subj:V.str(a.subj,40), min:V.int(a.min,10,240), type:V.one(a.type,['solo','duel','team'],'solo'), deadline:V.day(a.deadline), msg:V.str(a.msg,80)}); }},
  respondChallenge:{fn(a){ const x=allChallenges().find(y=>y.c.id===a.id && y.role==='receiver'); if(!x) throw new GameError('Challenge not found'); if(G.S.social.chState[a.id]) return; respondChallenge(a.id, !!a.accept); }},
  react:{fn(a){ const owner=V.ref(a.owner), ev=V.ref(a.evId); const e=V.one(a.emoji,REACTIONS,null); if(!e) throw new GameError('Unknown reaction'); if(owner===G.uid) return; toggleReaction(owner, ev, e); }},
  // housekeeping: league rollover, streak rewards, badges, team challenges
  sync:{fn(){ if(!G.S.profile) return; processLeagueRollover(); checkStreakRewards(); syncTeamChallenges(); checkBadges(true); }},
  reset:{fn(){ const keep=G.S.profile, tz=G.S.tz; G.S=newState(); G.S.profile=keep; G.S.tz=tz; }},
};
const AUTH_ACTIONS = Object.keys(MUT).filter(k=>MUT[k].auth);
/** Apply one action to G.S. Returns the action's result; throws GameError for player-facing problems. */
function applyAction(name, args){
  const m=MUT[name]; if(!m) throw new GameError('Unknown action');
  if(G.S.active && G.S.active.startedAt > nowMs()+60000) G.S.active=null; // clock sanity
  const res = m.fn(args||{});
  G.S.rev=(G.S.rev||0)+1;
  return res===undefined ? null : res;
}
/* ---------- public projection split: base = everyone signed in, detail = friends only ---------- */
const DETAIL_KEYS=['today','stats','city','chOut','chState','feed','reactions','studying'];
function splitPublic(p){ const base={}, detail={}; Object.keys(p).forEach(k=>{ (DETAIL_KEYS.includes(k)?detail:base)[k]=p[k]; }); base.pop = p.city ? p.city.pop : 0; return {base, detail}; }
function deepMergeState(base, data){
  if(!data || typeof data!=='object') return base;
  const out=Object.assign({}, base);
  Object.keys(data).forEach(k=>{ const b=base[k], d=data[k];
    if(b && typeof b==='object' && !Array.isArray(b) && d && typeof d==='object' && !Array.isArray(d)) out[k]=deepMergeState(b,d);
    else if(d!==undefined) out[k]=d; });
  return out;
}
