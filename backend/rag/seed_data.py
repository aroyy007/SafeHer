"""
SafeHer — Complete Knowledge Base Seed Data
=============================================
60+ bilingual (Bengali + English) verified facts covering:
  - Emergency numbers (999, 10921, Chittagong police, cybercrime)
  - Legal rights (Women & Children Repression Act, FIR, Penal Code)
  - Immediate action guides (being followed, bus, CNG, night walking)
  - Safe locations in Chittagong (hospitals, police boxes, pharmacies)
  - Digital safety (cybercrime helpline, Digital Security Act)
  - Medical evidence guidance
  - Transport-specific safety
  - Legal aid organizations

EVERY critical fact has BOTH Bengali and English versions.
This ensures retrieval works regardless of query language.

Sources:
  - Bangladesh Police official numbers
  - Prevention of Women and Children Repression Act 2000
  - Penal Code Section 354
  - Digital Security Act 2018
  - BLAST, ASK contact info
  - Local Chittagong knowledge
"""

from typing import List, Dict

KNOWLEDGE_BASE: List[Dict[str, str]] = [
    # ================================================================
    # EMERGENCY NUMBERS
    # ================================================================
    {
        "id": "E001_bn",
        "text": "জরুরী সাহায্যের জন্য ৯৯৯ কল করুন। পুলিশ, ফায়ার সার্ভিস ও অ্যাম্বুলেন্স। সম্পূর্ণ বিনামূল্যে, ২৪ ঘণ্টা, যেকোনো ফোন থেকে।",
        "category": "emergency",
        "lang": "bn",
    },
    {
        "id": "E001_en",
        "text": "National emergency number is 999. Covers police, fire service, and ambulance. Free to call 24/7 from any phone in Bangladesh.",
        "category": "emergency",
        "lang": "en",
    },
    {
        "id": "E002_bn",
        "text": "নারী ও শিশু নির্যাতন প্রতিরোধ হেল্পলাইন: ১০৯২১। যৌন হয়রানি, ধর্ষণ, নির্যাতন বা পাচারের ক্ষেত্রে কল করুন। ২৪ ঘণ্টা চালু।",
        "category": "emergency",
        "lang": "bn",
    },
    {
        "id": "E002_en",
        "text": "Women and Children Repression Prevention Hotline: 10921. For sexual harassment, rape, assault, domestic violence, or trafficking. Available 24/7.",
        "category": "emergency",
        "lang": "en",
    },
    {
        "id": "E003_bn",
        "text": "চট্টগ্রাম মেট্রোপলিটন পুলিশ হেল্পলাইন: ০১৭৬৯-৬৮০২৬৬। চট্টগ্রামে জরুরী পুলিশ সহায়তার জন্য কল করুন।",
        "category": "emergency",
        "lang": "bn",
    },
    {
        "id": "E003_en",
        "text": "Chittagong Metropolitan Police helpline: 01769-680266. Call for immediate police assistance in Chittagong city.",
        "category": "emergency",
        "lang": "en",
    },
    {
        "id": "E004_bn",
        "text": "ঢাকা মেট্রোপলিটন পুলিশ হেল্পলাইন: ০১৭৬৯-৬৯১৫২২। ঢাকায় জরুরী পুলিশ সহায়তার জন্য কল করুন।",
        "category": "emergency",
        "lang": "bn",
    },
    {
        "id": "E004_en",
        "text": "Dhaka Metropolitan Police helpline: 01769-691522. Call for immediate police assistance in Dhaka city.",
        "category": "emergency",
        "lang": "en",
    },
    {
        "id": "E005_bn",
        "text": "সাইবার অপরাধ হেল্পলাইন: ০১৭৬৬-৬৭৮৮৮৮। অনলাইন হয়রানি, হুমকি, ব্ল্যাকমেইল বা ব্যক্তিগত ছবির অপব্যবহারের ক্ষেত্রে কল করুন।",
        "category": "emergency",
        "lang": "bn",
    },
    {
        "id": "E005_en",
        "text": "Cybercrime helpline Bangladesh: 01766-678888. For online harassment, threats, blackmail, or non-consensual sharing of personal images.",
        "category": "emergency",
        "lang": "en",
    },
    {
        "id": "E006_bn",
        "text": "জাতীয় জরুরী সেবা অ্যাম্বুলেন্স: ৯৯৯। ফায়ার সার্ভিস জরুরী: ১৯৯।",
        "category": "emergency",
        "lang": "bn",
    },
    {
        "id": "E006_en",
        "text": "National ambulance via 999. Fire service emergency: 199. Both are free 24/7 services.",
        "category": "emergency",
        "lang": "en",
    },

    # ================================================================
    # IMMEDIATE ACTION GUIDANCE
    # ================================================================
    {
        "id": "A001_bn",
        "text": "কেউ পিছু নিলে: সাথে সাথে কাছের মসজিদ, ফার্মেসি বা ভিড়ের দোকানে ঢুকুন। বাড়ির দিকে যাবেন না — তাহলে তারা আপনার ঠিকানা জানবে। ৯৯৯ কল করুন।",
        "category": "action",
        "lang": "bn",
    },
    {
        "id": "A001_en",
        "text": "If being followed on foot: immediately enter a nearby mosque, pharmacy, or crowded shop. Do NOT go home — they will learn your address. Call 999.",
        "category": "action",
        "lang": "en",
    },
    {
        "id": "A002_bn",
        "text": "সিএনজি বা রিকশায় অনিরাপদ লাগলে: গাড়ির নম্বর মনে রাখুন বা ফোনে ছবি তুলুন। ব্যস্ত, আলোকিত মোড়ে থামতে বলুন। অন্ধকার গলিতে নামবেন না। ৯৯৯ কল করুন।",
        "category": "action",
        "lang": "bn",
    },
    {
        "id": "A002_en",
        "text": "If feeling unsafe in a CNG or rickshaw: memorize or photograph the vehicle registration number. Ask the driver to stop at a busy, well-lit intersection. Never get off in a dark alley. Call 999.",
        "category": "action",
        "lang": "en",
    },
    {
        "id": "A003_bn",
        "text": "বাসে হয়রানি হলে: জোরে কথা বলুন, পাশের যাত্রীদের সাহায্য চান। চালক বা হেল্পারকে ডাকুন। পরের জনবহুল স্টপে নামুন। লজ্জা পাবেন না — আপনার নিরাপত্তা সবচেয়ে গুরুত্বপূর্ণ।",
        "category": "action",
        "lang": "bn",
    },
    {
        "id": "A003_en",
        "text": "If harassed on a public bus: speak loudly and firmly, alert nearby passengers. Call on the driver or helper. Get off at the next populated stop. Do not feel ashamed — your safety is most important.",
        "category": "action",
        "lang": "en",
    },
    {
        "id": "A004_bn",
        "text": "যদি কেউ অশালীনভাবে স্পর্শ করে: জোরে চিৎকার করুন, মনোযোগ আকর্ষণ করুন। প্রকাশ্য জায়গায় মানুষ আপনার পাশে দাঁড়াবে যদি আপনি সাহায্য চান।",
        "category": "action",
        "lang": "bn",
    },
    {
        "id": "A004_en",
        "text": "If someone touches you inappropriately: shout loudly to attract attention. In public spaces, people will intervene if you are vocal and ask for help.",
        "category": "action",
        "lang": "en",
    },
    {
        "id": "A005_bn",
        "text": "রাতে একা হাঁটার সময়: ব্যস্ত, আলোকিত রাস্তায় থাকুন। ইয়ারফোন ব্যবহার করবেন না। ফোন চার্জ রাখুন। পরিবারকে আপনার রুট জানান। SafeHer-এর নিরাপদ রুট ব্যবহার করুন।",
        "category": "action",
        "lang": "bn",
    },
    {
        "id": "A005_en",
        "text": "When walking alone at night: stay on busy, well-lit streets. Do not use earphones. Keep your phone charged. Tell family your route. Use SafeHer's safe route feature.",
        "category": "action",
        "lang": "en",
    },
    {
        "id": "A006_bn",
        "text": "ফোনের চার্জ কম থাকলে: প্রথমে পরিবারকে আপনার লাইভ লোকেশন লিংক পাঠান, তারপর ফোন কল করুন। লোকেশন শেয়ার সবচেয়ে গুরুত্বপূর্ণ।",
        "category": "action",
        "lang": "bn",
    },
    {
        "id": "A006_en",
        "text": "If your phone battery is low: send your live location link to family contacts FIRST, before making any calls. Location sharing is the highest priority.",
        "category": "action",
        "lang": "en",
    },
    {
        "id": "A007_bn",
        "text": "কেউ গাড়িতে টেনে নিতে চাইলে: জোরে চিৎকার করুন, মাটিতে বসে পড়ুন, পায়ের নখ দিয়ে আঁচড়ান। গাড়ির নম্বর মনে রাখার চেষ্টা করুন।",
        "category": "action",
        "lang": "bn",
    },
    {
        "id": "A007_en",
        "text": "If someone tries to pull you into a vehicle: scream loudly, sit or drop to the ground to make yourself harder to move, scratch with your nails. Try to remember the vehicle number.",
        "category": "action",
        "lang": "en",
    },

    # ================================================================
    # SAFE LOCATIONS IN CHITTAGONG
    # ================================================================
    {
        "id": "S001_bn",
        "text": "চট্টগ্রামে নিরাপদ আশ্রয়: যেকোনো হাসপাতাল (চট্টগ্রাম মেডিকেল কলেজ, মেক্স হসপিটাল), পুলিশ বক্স (প্রধান মোড়ে পাবেন), ২৪ ঘণ্টা ফার্মেসি, নামাজের সময় মসজিদ, ব্যস্ত বাজার।",
        "category": "safe_location",
        "lang": "bn",
    },
    {
        "id": "S001_en",
        "text": "Safe places to go in Chittagong: any hospital (Chittagong Medical College Hospital, Max Hospital), police boxes (found at major intersections), 24-hour pharmacies, mosques during prayer times, busy markets.",
        "category": "safe_location",
        "lang": "en",
    },
    {
        "id": "S002_bn",
        "text": "চট্টগ্রামের বিপজ্জনক এলাকা রাতে: জিইসি সার্কেল এলাকা রাত ১০টার পরে, বাহাদ্দারহাট ইন্টারসেকশন, অক্সিজেন মোড়, মুরাদপুর, রেলওয়ে স্টেশন এলাকা। এই জায়গাগুলো রাতে এড়িয়ে চলুন।",
        "category": "safe_location",
        "lang": "bn",
    },
    {
        "id": "S002_en",
        "text": "Areas to avoid at night in Chittagong: GEC Circle area after 10 PM, Bahaddarhat intersection, Oxygen crossing, Muradpur, Railway station area. These areas have higher incident reports after dark.",
        "category": "safe_location",
        "lang": "en",
    },
    {
        "id": "S003_bn",
        "text": "নিকটতম পুলিশ স্টেশন খুঁজুন: চট্টগ্রাম কোতোয়ালি থানা (আন্দরকিল্লা), পাঁচলাইশ থানা, বায়েজিদ থানা, হালিশহর থানা। ৯৯৯ কল করলে নিকটতম পুলিশকে পাঠানো হবে।",
        "category": "safe_location",
        "lang": "bn",
    },
    {
        "id": "S003_en",
        "text": "Nearest police stations in Chittagong: Kotwali Police Station (Anderkilla), Panchlaish, Bayezid, Halishahar. Calling 999 automatically dispatches the nearest police unit.",
        "category": "safe_location",
        "lang": "en",
    },

    # ================================================================
    # LEGAL RIGHTS
    # ================================================================
    {
        "id": "L001_bn",
        "text": "নারী ও শিশু নির্যাতন দমন আইন ২০০০ অনুযায়ী, প্রকাশ্য স্থানে যৌন হয়রানি ফৌজদারি অপরাধ। সর্বোচ্চ সাজা ৭ বছর কারাদণ্ড।",
        "category": "legal",
        "lang": "bn",
    },
    {
        "id": "L001_en",
        "text": "Under the Prevention of Women and Children Repression Act 2000, sexual harassment in public is a criminal offense punishable by imprisonment up to 7 years.",
        "category": "legal",
        "lang": "en",
    },
    {
        "id": "L002_bn",
        "text": "দণ্ডবিধির ধারা ৩৫৪ অনুযায়ী নারীর শালীনতা নষ্ট করার উদ্দেশ্যে বলপ্রয়োগ শাস্তিযোগ্য অপরাধ। সর্বোচ্চ ২ বছর কারাদণ্ড।",
        "category": "legal",
        "lang": "bn",
    },
    {
        "id": "L002_en",
        "text": "Penal Code Section 354 criminalizes assault or criminal force to outrage the modesty of a woman. Punishment: up to 2 years imprisonment.",
        "category": "legal",
        "lang": "en",
    },
    {
        "id": "L003_bn",
        "text": "যেকোনো থানায় এফআইআর (First Information Report) দায়ের করার অধিকার আপনার আছে। পুলিশ মামলা নিতে অস্বীকার করতে পারে না। অস্বীকার করলে সুপারিনটেনডেন্ট অব পুলিশের কাছে অভিযোগ করুন।",
        "category": "legal",
        "lang": "bn",
    },
    {
        "id": "L003_en",
        "text": "You have the right to file a First Information Report (FIR) at any police station. Police cannot legally refuse to register an FIR for violence against women. If refused, complain to the Superintendent of Police or approach a magistrate court.",
        "category": "legal",
        "lang": "en",
    },
    {
        "id": "L004_bn",
        "text": "ধর্ষণের শাস্তি: নারী ও শিশু নির্যাতন দমন আইনের ৯ ধারা অনুযায়ী ধর্ষণের সর্বোচ্চ শাস্তি যাবজ্জীবন কারাদণ্ড এবং অর্থদণ্ড।",
        "category": "legal",
        "lang": "bn",
    },
    {
        "id": "L004_en",
        "text": "Punishment for rape: Under Section 9 of the Prevention of Women and Children Repression Act, the maximum punishment for rape is life imprisonment and fine.",
        "category": "legal",
        "lang": "en",
    },
    {
        "id": "L005_bn",
        "text": "ইভ টিজিং (যৌন হয়রানি) আইনত দণ্ডনীয় অপরাধ। মোবাইল কোর্ট আইন ২০০৯ অনুযায়ী, ইভ টিজিংয়ের জন্য ভ্রাম্যমাণ আদালত ঘটনাস্থলেই শাস্তি দিতে পারে।",
        "category": "legal",
        "lang": "bn",
    },
    {
        "id": "L005_en",
        "text": "Eve teasing (sexual harassment) is a punishable criminal offense. Under the Mobile Court Act 2009, mobile courts can punish eve teasing on the spot.",
        "category": "legal",
        "lang": "en",
    },

    # ================================================================
    # DIGITAL SAFETY
    # ================================================================
    {
        "id": "D001_bn",
        "text": "ডিজিটাল নিরাপত্তা আইন ২০১৮ অনুযায়ী অনলাইন হয়রানি, স্টকিং এবং সম্মতি ছাড়া ব্যক্তিগত ছবি শেয়ার করা শাস্তিযোগ্য অপরাধ। সাইবার ক্রাইম হেল্পলাইন: ০১৭৬৬-৬৭৮৮৮৮।",
        "category": "digital",
        "lang": "bn",
    },
    {
        "id": "D001_en",
        "text": "The Digital Security Act 2018 criminalizes online harassment, stalking, and non-consensual sharing of intimate images. Cybercrime helpline: 01766-678888.",
        "category": "digital",
        "lang": "en",
    },
    {
        "id": "D002_bn",
        "text": "অনলাইনে হুমকি বা ব্ল্যাকমেইল হলে: স্ক্রিনশট সংরক্ষণ করুন, ব্লক করবেন না (প্রমাণ হারাবেন), সাইবার ক্রাইম হেল্পলাইনে কল করুন, নিকটতম থানায় GD (জেনারেল ডায়েরি) করুন।",
        "category": "digital",
        "lang": "bn",
    },
    {
        "id": "D002_en",
        "text": "If threatened or blackmailed online: save screenshots as evidence, do NOT block immediately (you will lose evidence), call cybercrime helpline 01766-678888, file a GD (General Diary) at the nearest police station.",
        "category": "digital",
        "lang": "en",
    },

    # ================================================================
    # LEGAL AID ORGANIZATIONS
    # ================================================================
    {
        "id": "LA001_bn",
        "text": "বিনামূল্যে আইনি সহায়তা: BLAST (Bangladesh Legal Aid and Services Trust) — 02-41033011। নারী ও শিশুদের জন্য বিনামূল্যে আইনি পরামর্শ প্রদান করে।",
        "category": "legal_aid",
        "lang": "bn",
    },
    {
        "id": "LA001_en",
        "text": "Free legal help: BLAST (Bangladesh Legal Aid and Services Trust) — 02-41033011. Provides free legal counsel for women and children.",
        "category": "legal_aid",
        "lang": "en",
    },
    {
        "id": "LA002_bn",
        "text": "আইন ও সালিশ কেন্দ্র (ASK): ০১৮১৯-৪৫৪১৫১। মানবাধিকার ও নারী অধিকার বিষয়ে আইনি সহায়তা প্রদান করে।",
        "category": "legal_aid",
        "lang": "bn",
    },
    {
        "id": "LA002_en",
        "text": "Ain o Salish Kendra (ASK): 01819-454151. Provides legal support on human rights and women's rights issues.",
        "category": "legal_aid",
        "lang": "en",
    },
    {
        "id": "LA003_bn",
        "text": "বাংলাদেশ মহিলা পরিষদ: ০২-৮৬১৩৪৬৫। নারী নির্যাতন প্রতিরোধে কাজ করে এবং আইনি সহায়তা দেয়।",
        "category": "legal_aid",
        "lang": "bn",
    },
    {
        "id": "LA003_en",
        "text": "Bangladesh Mahila Parishad: 02-8613465. Works on preventing violence against women and provides legal assistance.",
        "category": "legal_aid",
        "lang": "en",
    },

    # ================================================================
    # MEDICAL EVIDENCE & HEALTH
    # ================================================================
    {
        "id": "M001_bn",
        "text": "ধর্ষণ বা যৌন নির্যাতনের পর ৭২ ঘণ্টার মধ্যে হাসপাতালে যান। ফরেনসিক প্রমাণ সংগ্রহের জন্য এটি অত্যন্ত গুরুত্বপূর্ণ। মেডিকেল সার্টিফিকেট নিন — এটি আদালতে প্রমাণ হিসেবে ব্যবহৃত হবে।",
        "category": "medical",
        "lang": "bn",
    },
    {
        "id": "M001_en",
        "text": "After rape or sexual assault: go to a hospital within 72 hours. This is critical for forensic evidence collection. Get a medical certificate — it will be used as evidence in court.",
        "category": "medical",
        "lang": "en",
    },
    {
        "id": "M002_bn",
        "text": "যৌন নির্যাতনের পর গোসল করবেন না, কাপড় পরিবর্তন করবেন না (যদি সম্ভব হয়) — এগুলো ফরেনসিক প্রমাণ। সরাসরি হাসপাতালে যান।",
        "category": "medical",
        "lang": "bn",
    },
    {
        "id": "M002_en",
        "text": "After sexual assault: do not bathe or change clothes if possible — these are forensic evidence. Go directly to the hospital.",
        "category": "medical",
        "lang": "en",
    },
    {
        "id": "M003_bn",
        "text": "One-stop Crisis Centre (OCC): চট্টগ্রাম মেডিকেল কলেজ হাসপাতালে ওয়ান-স্টপ ক্রাইসিস সেন্টার আছে। এখানে চিকিৎসা, আইনি সহায়তা ও কাউন্সেলিং একসাথে পাবেন।",
        "category": "medical",
        "lang": "bn",
    },
    {
        "id": "M003_en",
        "text": "One-stop Crisis Centre (OCC) at Chittagong Medical College Hospital provides medical treatment, legal aid, and counseling together in one place for violence survivors.",
        "category": "medical",
        "lang": "en",
    },

    # ================================================================
    # TRANSPORT-SPECIFIC SAFETY
    # ================================================================
    {
        "id": "T001_bn",
        "text": "রাতে রাইড শেয়ারিং (Uber/Pathao) ব্যবহারে: ড্রাইভারের নাম ও গাড়ির নম্বর পরিবারকে শেয়ার করুন। 'শেয়ার ট্রিপ' ফিচার ব্যবহার করুন। সামনের সিটে বসবেন না।",
        "category": "transport",
        "lang": "bn",
    },
    {
        "id": "T001_en",
        "text": "When using ride-sharing (Uber/Pathao) at night: share the driver's name and vehicle number with family. Use the 'share trip' feature. Do not sit in the front seat.",
        "category": "transport",
        "lang": "en",
    },
    {
        "id": "T002_bn",
        "text": "রেলওয়ে স্টেশনে: মহিলাদের জন্য আলাদা ওয়েটিং রুম আছে। রাতে একা প্ল্যাটফর্মে দাঁড়াবেন না। স্টেশন মাস্টারের অফিসে যান।",
        "category": "transport",
        "lang": "bn",
    },
    {
        "id": "T002_en",
        "text": "At railway stations: separate waiting rooms exist for women. Do not stand alone on the platform at night. Go to the station master's office for safety.",
        "category": "transport",
        "lang": "en",
    },

    # ================================================================
    # GENERAL SAFETY TIPS
    # ================================================================
    {
        "id": "G001_bn",
        "text": "অপরিচিত কেউ গাড়িতে লিফট দিতে চাইলে: কখনো উঠবেন না, যতই পরিচিত মনে হোক। নিজের যানবাহন ব্যবহার করুন বা পরিবারকে কল করুন।",
        "category": "general_safety",
        "lang": "bn",
    },
    {
        "id": "G001_en",
        "text": "If a stranger offers you a ride: never accept, no matter how familiar they seem. Use your own transport or call family.",
        "category": "general_safety",
        "lang": "en",
    },
    {
        "id": "G002_bn",
        "text": "টাকা, মোবাইল বা গহনা ছিনতাই হলে: প্রতিরোধ করবেন না যদি তারা সশস্ত্র হয়। জীবন সবচেয়ে মূল্যবান। নিরাপদ হওয়ার পর ৯৯৯ কল করুন।",
        "category": "general_safety",
        "lang": "bn",
    },
    {
        "id": "G002_en",
        "text": "If mugged for money, phone, or jewelry: do not resist if they are armed. Your life is most valuable. Call 999 once you are safe.",
        "category": "general_safety",
        "lang": "en",
    },
    {
        "id": "G003_bn",
        "text": "নিরাপদ এলাকায় থাকুন: আলোকিত রাস্তা, সিসিটিভি ক্যামেরা আছে এমন জায়গা, দোকান বা রেস্টুরেন্টের কাছে, পুলিশ বক্সের কাছে।",
        "category": "general_safety",
        "lang": "bn",
    },
    {
        "id": "G003_en",
        "text": "Stay in safe areas: well-lit streets, places with CCTV cameras, near shops or restaurants, near police boxes.",
        "category": "general_safety",
        "lang": "en",
    },

    # ================================================================
    # WHAT IS SAFEHER (app-specific)
    # ================================================================
    {
        "id": "APP001_bn",
        "text": "SafeHer হলো বাংলাদেশের নারীদের জন্য একটি নিরাপত্তা ওয়েবসাইট। এতে আছে: SOS বাটন, ভয়েস অ্যাক্টিভেটেড জরুরী সেবা, নিরাপদ রুট সুপারিশ, এবং AI সেফটি অ্যাসিস্ট্যান্ট।",
        "category": "app_info",
        "lang": "bn",
    },
    {
        "id": "APP001_en",
        "text": "SafeHer is a safety website for women in Bangladesh. It includes: SOS button, voice-activated emergency (say 'বাঁচাও'), safe route recommendation, community safety map, and AI safety assistant.",
        "category": "app_info",
        "lang": "en",
    },
    {
        "id": "APP002_bn",
        "text": "SafeHer-এর SOS বাটন ৩ সেকেন্ড চেপে ধরুন। আপনার বিশ্বস্ত যোগাযোগদের ইমেইলে জরুরী বার্তা ও আপনার লাইভ লোকেশন পাঠানো হবে।",
        "category": "app_info",
        "lang": "bn",
    },
    {
        "id": "APP002_en",
        "text": "Hold SafeHer's SOS button for 3 seconds. An emergency email with your live location will be sent to all your trusted contacts immediately.",
        "category": "app_info",
        "lang": "en",
    },

    # ================================================================
    # DOMESTIC VIOLENCE
    # ================================================================
    {
        "id": "DV001_bn",
        "text": "পারিবারিক সহিংসতার শিকার হলে: ১০৯২১ কল করুন। পারিবারিক সহিংসতা (প্রতিরোধ ও সুরক্ষা) আইন ২০১০ আপনাকে সুরক্ষা আদেশ পাওয়ার অধিকার দেয়।",
        "category": "domestic_violence",
        "lang": "bn",
    },
    {
        "id": "DV001_en",
        "text": "If you are a victim of domestic violence: call 10921. The Domestic Violence (Prevention and Protection) Act 2010 gives you the right to obtain a protection order.",
        "category": "domestic_violence",
        "lang": "en",
    },
    {
        "id": "DV002_bn",
        "text": "ঘরে নিরাপদ না হলে: নিকটতম আত্মীয় বা বিশ্বস্ত প্রতিবেশীর কাছে যান। নারী ও শিশু নির্যাতন দমন ট্রাইব্যুনালে সরাসরি মামলা করতে পারেন।",
        "category": "domestic_violence",
        "lang": "bn",
    },
    {
        "id": "DV002_en",
        "text": "If not safe at home: go to the nearest relative or trusted neighbor. You can file a case directly at the Women and Children Repression Prevention Tribunal.",
        "category": "domestic_violence",
        "lang": "en",
    },

    # ================================================================
    # CHILD SAFETY
    # ================================================================
    {
        "id": "C001_bn",
        "text": "শিশু নির্যাতনের ক্ষেত্রে: ১০৯২১ কল করুন। শিশু আইন ২০১৩ অনুযায়ী, ১৮ বছরের নিচে যেকোনো শিশুর প্রতি সহিংসতা কঠোর শাস্তিযোগ্য।",
        "category": "child_safety",
        "lang": "bn",
    },
    {
        "id": "C001_en",
        "text": "In case of child abuse: call 10921. Under the Children Act 2013, any violence against a child under 18 is punishable with severe penalties.",
        "category": "child_safety",
        "lang": "en",
    },
]


def get_all_entries() -> list:
    """Return all knowledge base entries."""
    return KNOWLEDGE_BASE


def get_entries_by_category(category: str) -> list:
    """Return entries filtered by category."""
    return [entry for entry in KNOWLEDGE_BASE if entry["category"] == category]


def get_entry_count() -> int:
    """Return total number of entries."""
    return len(KNOWLEDGE_BASE)
