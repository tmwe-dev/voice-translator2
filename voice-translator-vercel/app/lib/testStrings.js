// ═══════════════════════════════════════════════
// Test strings for the Translation Test Center
//
// Each language has 4 scenarios:
// - travel: Tourism/directions/booking
// - business: Professional/meetings/documents
// - emergency: Urgent help/medical/safety
// - casual: Informal conversation/daily life
//
// Strings are 3-4 sentences long (realistic speech segments)
// ═══════════════════════════════════════════════

export const TEST_STRINGS = {
  'it': {
    travel: "Buongiorno, vorrei prenotare una camera doppia per tre notti. Avete disponibilità per questo fine settimana? Il prezzo include la colazione?",
    business: "La riunione è stata rinviata a giovedì prossimo. Potrebbe confermare la sua disponibilità e inviare i documenti aggiornati entro domani sera?",
    emergency: "Mi scusi, ho bisogno di aiuto urgente. Mi sono perso e non parlo la lingua locale. Potrebbe indicarmi la direzione per l'ospedale più vicino?",
    casual: "Ciao! Come stai? Ieri sera siamo andati a mangiare in quel ristorante nuovo vicino alla piazza. Il cibo era fantastico, dovresti provarlo!",
  },
  'en': {
    travel: "Good morning, I'd like to book a double room for three nights. Do you have availability this weekend? Does the price include breakfast?",
    business: "The meeting has been postponed to next Thursday. Could you confirm your availability and send the updated documents by tomorrow evening?",
    emergency: "Excuse me, I need urgent help. I'm lost and I don't speak the local language. Could you point me in the direction of the nearest hospital?",
    casual: "Hey! How are you doing? Last night we went to that new restaurant near the square. The food was amazing, you should try it!",
  },
  'th': {
    travel: "สวัสดีครับ ผมต้องการจองห้องพักคู่สามคืน มีห้องว่างสุดสัปดาห์นี้ไหมครับ ราคารวมอาหารเช้าด้วยไหม",
    business: "การประชุมถูกเลื่อนไปเป็นวันพฤหัสหน้า คุณช่วยยืนยันว่าว่างไหม แล้วส่งเอกสารที่อัปเดตมาภายในพรุ่งนี้เย็นได้ไหมครับ",
    emergency: "ขอโทษครับ ผมต้องการความช่วยเหลือด่วน ผมหลงทางและไม่พูดภาษาท้องถิ่น ช่วยบอกทางไปโรงพยาบาลที่ใกล้ที่สุดได้ไหมครับ",
    casual: "สวัสดี! สบายดีไหม เมื่อวานเราไปกินข้าวที่ร้านใหม่ใกล้จัตุรัส อาหารอร่อยมาก คุณควรไปลองดู!",
  },
  'zh': {
    travel: "你好，我想预订一间双人房，住三晚。这个周末有空房吗？价格包含早餐吗？",
    business: "会议已经推迟到下周四。您能确认您的时间安排，并在明天晚上之前发送更新的文件吗？",
    emergency: "打扰一下，我需要紧急帮助。我迷路了，不会说当地语言。您能告诉我最近的医院在哪里吗？",
    casual: "嗨！你好吗？昨晚我们去了广场附近那家新餐厅吃饭。菜太好吃了，你应该去尝尝！",
  },
  'ja': {
    travel: "こんにちは、ダブルルームを3泊予約したいのですが。今週末空いていますか？料金に朝食は含まれていますか？",
    business: "会議は来週の木曜日に延期されました。ご都合を確認いただき、明日の夕方までに更新された資料を送っていただけますか？",
    emergency: "すみません、緊急の助けが必要です。道に迷ってしまい、現地の言葉が話せません。一番近い病院への行き方を教えていただけますか？",
    casual: "やあ！元気？昨日の夜、広場の近くにできた新しいレストランに行ったんだ。料理がすごく美味しかったよ、行ってみて！",
  },
  'ko': {
    travel: "안녕하세요, 더블룸을 3박 예약하고 싶습니다. 이번 주말에 빈 방이 있나요? 가격에 조식이 포함되어 있나요?",
    business: "회의가 다음 주 목요일로 연기되었습니다. 참석 가능 여부를 확인해 주시고, 내일 저녁까지 업데이트된 문서를 보내주시겠습니까?",
    emergency: "실례합니다, 긴급한 도움이 필요합니다. 길을 잃었고 현지 언어를 못합니다. 가장 가까운 병원으로 가는 길을 알려주시겠습니까?",
    casual: "안녕! 잘 지내? 어젯밤에 광장 근처에 새로 생긴 식당에 갔어. 음식이 정말 맛있었어, 한번 가봐!",
  },
  'ar': {
    travel: "صباح الخير، أود حجز غرفة مزدوجة لثلاث ليالٍ. هل لديكم غرف متاحة هذا الأسبوع؟ هل السعر يشمل الفطور؟",
    business: "تم تأجيل الاجتماع إلى يوم الخميس القادم. هل يمكنك تأكيد توفرك وإرسال المستندات المحدثة بحلول مساء الغد؟",
    emergency: "عفواً، أحتاج إلى مساعدة عاجلة. أنا تائه ولا أتحدث اللغة المحلية. هل يمكنك أن تدلني على أقرب مستشفى؟",
    casual: "مرحباً! كيف حالك؟ ذهبنا البارحة إلى المطعم الجديد بجانب الساحة. كان الطعام رائعاً، يجب أن تجربه!",
  },
  'hi': {
    travel: "नमस्ते, मैं तीन रातों के लिए एक डबल रूम बुक करना चाहता हूँ। क्या इस सप्ताहांत कमरा उपलब्ध है? क्या कीमत में नाश्ता शामिल है?",
    business: "बैठक अगले गुरुवार तक स्थगित कर दी गई है। क्या आप अपनी उपलब्धता की पुष्टि कर सकते हैं और कल शाम तक अपडेट किए गए दस्तावेज़ भेज सकते हैं?",
    emergency: "माफ कीजिए, मुझे तुरंत मदद चाहिए। मैं रास्ता भूल गया हूँ और स्थानीय भाषा नहीं बोलता। क्या आप मुझे निकटतम अस्पताल का रास्ता बता सकते हैं?",
    casual: "नमस्ते! कैसे हो? कल रात हम चौक के पास उस नए रेस्तरां में खाना खाने गए। खाना शानदार था, तुम्हें भी जाना चाहिए!",
  },
  'ru': {
    travel: "Здравствуйте, я хотел бы забронировать двухместный номер на три ночи. Есть ли свободные номера на эти выходные? Завтрак включён в стоимость?",
    business: "Встреча перенесена на следующий четверг. Не могли бы вы подтвердить вашу доступность и отправить обновлённые документы до завтрашнего вечера?",
    emergency: "Извините, мне нужна срочная помощь. Я потерялся и не говорю на местном языке. Не могли бы вы указать мне направление к ближайшей больнице?",
    casual: "Привет! Как дела? Вчера мы ходили в тот новый ресторан возле площади. Еда была потрясающая, тебе стоит попробовать!",
  },
  'es': {
    travel: "Buenos días, quisiera reservar una habitación doble para tres noches. ¿Tienen disponibilidad este fin de semana? ¿El precio incluye desayuno?",
    business: "La reunión se ha aplazado para el próximo jueves. ¿Podría confirmar su disponibilidad y enviar los documentos actualizados antes de mañana por la noche?",
    emergency: "Disculpe, necesito ayuda urgente. Estoy perdido y no hablo el idioma local. ¿Podría indicarme la dirección del hospital más cercano?",
    casual: "¡Hola! ¿Cómo estás? Anoche fuimos a cenar a ese restaurante nuevo cerca de la plaza. ¡La comida estaba increíble, deberías probarlo!",
  },
  'fr': {
    travel: "Bonjour, je voudrais réserver une chambre double pour trois nuits. Avez-vous des disponibilités ce week-end ? Le prix inclut-il le petit-déjeuner ?",
    business: "La réunion a été reportée à jeudi prochain. Pourriez-vous confirmer votre disponibilité et envoyer les documents mis à jour avant demain soir ?",
    emergency: "Excusez-moi, j'ai besoin d'aide urgente. Je suis perdu et je ne parle pas la langue locale. Pourriez-vous m'indiquer la direction de l'hôpital le plus proche ?",
    casual: "Salut ! Comment vas-tu ? Hier soir, on est allés manger dans ce nouveau restaurant près de la place. La nourriture était incroyable, tu devrais essayer !",
  },
  'de': {
    travel: "Guten Morgen, ich möchte ein Doppelzimmer für drei Nächte buchen. Haben Sie dieses Wochenende noch Verfügbarkeit? Ist das Frühstück im Preis enthalten?",
    business: "Das Meeting wurde auf nächsten Donnerstag verschoben. Könnten Sie Ihre Verfügbarkeit bestätigen und die aktualisierten Unterlagen bis morgen Abend schicken?",
    emergency: "Entschuldigung, ich brauche dringend Hilfe. Ich habe mich verlaufen und spreche die Landessprache nicht. Könnten Sie mir den Weg zum nächsten Krankenhaus zeigen?",
    casual: "Hallo! Wie geht's dir? Gestern Abend waren wir in dem neuen Restaurant am Platz essen. Das Essen war fantastisch, du solltest es mal probieren!",
  },
  'pt': {
    travel: "Bom dia, gostaria de reservar um quarto duplo por três noites. Vocês têm disponibilidade neste fim de semana? O preço inclui café da manhã?",
    business: "A reunião foi adiada para a próxima quinta-feira. Poderia confirmar sua disponibilidade e enviar os documentos atualizados até amanhã à noite?",
    emergency: "Com licença, preciso de ajuda urgente. Estou perdido e não falo a língua local. Poderia me indicar a direção do hospital mais próximo?",
    casual: "Oi! Como você está? Ontem à noite fomos comer naquele restaurante novo perto da praça. A comida estava incrível, você deveria experimentar!",
  },
  'tr': {
    travel: "Günaydın, üç gecelik çift kişilik bir oda rezervasyonu yapmak istiyorum. Bu hafta sonu müsait odanız var mı? Fiyata kahvaltı dahil mi?",
    business: "Toplantı gelecek perşembeye ertelendi. Müsaitliğinizi onaylayıp güncellenmiş belgeleri yarın akşama kadar gönderebilir misiniz?",
    emergency: "Affedersiniz, acil yardıma ihtiyacım var. Kayboldum ve yerel dili konuşamıyorum. Bana en yakın hastanenin yönünü gösterebilir misiniz?",
    casual: "Merhaba! Nasılsın? Dün akşam meydanın yanındaki yeni restorana yemeğe gittik. Yemekler harikaydı, bir denemelisin!",
  },
  'vi': {
    travel: "Xin chào, tôi muốn đặt phòng đôi cho ba đêm. Cuối tuần này còn phòng trống không? Giá phòng có bao gồm bữa sáng không?",
    business: "Cuộc họp đã được dời sang thứ Năm tuần sau. Bạn có thể xác nhận lịch rảnh và gửi tài liệu cập nhật trước tối mai được không?",
    emergency: "Xin lỗi, tôi cần sự giúp đỡ khẩn cấp. Tôi bị lạc và không nói được tiếng địa phương. Bạn có thể chỉ cho tôi đường đến bệnh viện gần nhất không?",
    casual: "Xin chào! Bạn khỏe không? Tối qua chúng tôi đã đi ăn ở nhà hàng mới gần quảng trường. Đồ ăn ngon lắm, bạn nên thử!",
  },
  'nl': {
    travel: "Goedemorgen, ik zou graag een tweepersoonskamer boeken voor drie nachten. Heeft u beschikbaarheid dit weekend? Is het ontbijt bij de prijs inbegrepen?",
    business: "De vergadering is uitgesteld tot aanstaande donderdag. Kunt u uw beschikbaarheid bevestigen en de bijgewerkte documenten voor morgenavond sturen?",
    emergency: "Pardon, ik heb dringend hulp nodig. Ik ben verdwaald en spreek de lokale taal niet. Kunt u mij de weg naar het dichtstbijzijnde ziekenhuis wijzen?",
    casual: "Hoi! Hoe gaat het? Gisteravond zijn we gaan eten bij dat nieuwe restaurant bij het plein. Het eten was fantastisch, je moet het proberen!",
  },
  'pl': {
    travel: "Dzień dobry, chciałbym zarezerwować pokój dwuosobowy na trzy noce. Czy macie wolne pokoje w ten weekend? Czy cena obejmuje śniadanie?",
    business: "Spotkanie zostało przełożone na przyszły czwartek. Czy mogłby Pan potwierdzić swoją dostępność i przesłać zaktualizowane dokumenty do jutrzejszego wieczora?",
    emergency: "Przepraszam, potrzebuję pilnej pomocy. Zgubiłem się i nie mówię w lokalnym języku. Czy mógłby mi Pan wskazać drogę do najbliższego szpitala?",
    casual: "Cześć! Jak się masz? Wczoraj wieczorem poszliśmy do tej nowej restauracji koło rynku. Jedzenie było fantastyczne, powinieneś spróbować!",
  },
  'sv': {
    travel: "God morgon, jag skulle vilja boka ett dubbelrum för tre nätter. Har ni lediga rum i helgen? Ingår frukost i priset?",
    business: "Mötet har skjutits upp till nästa torsdag. Kan du bekräfta din tillgänglighet och skicka de uppdaterade dokumenten senast imorgon kväll?",
    emergency: "Ursäkta, jag behöver akut hjälp. Jag har gått vilse och talar inte det lokala språket. Kan du visa mig vägen till närmaste sjukhus?",
    casual: "Hej! Hur mår du? Igår kväll gick vi och åt på den nya restaurangen vid torget. Maten var fantastisk, du borde prova!",
  },
  'el': {
    travel: "Καλημέρα, θα ήθελα να κλείσω ένα δίκλινο δωμάτιο για τρεις νύχτες. Έχετε διαθεσιμότητα αυτό το Σαββατοκύριακο; Το πρωινό περιλαμβάνεται στην τιμή;",
    business: "Η συνάντηση αναβλήθηκε για την επόμενη Πέμπτη. Θα μπορούσατε να επιβεβαιώσετε τη διαθεσιμότητά σας και να στείλετε τα ενημερωμένα έγγραφα μέχρι αύριο το βράδυ;",
    emergency: "Με συγχωρείτε, χρειάζομαι επείγουσα βοήθεια. Έχω χαθεί και δεν μιλάω την τοπική γλώσσα. Μπορείτε να μου δείξετε τον δρόμο για το πλησιέστερο νοσοκομείο;",
    casual: "Γεια! Πώς είσαι; Χθες βράδυ πήγαμε να φάμε στο νέο εστιατόριο κοντά στην πλατεία. Το φαγητό ήταν καταπληκτικό, πρέπει να το δοκιμάσεις!",
  },
  'id': {
    travel: "Selamat pagi, saya ingin memesan kamar double untuk tiga malam. Apakah ada kamar yang tersedia akhir pekan ini? Apakah harganya termasuk sarapan?",
    business: "Rapat telah ditunda hingga Kamis depan. Bisakah Anda mengkonfirmasi ketersediaan Anda dan mengirimkan dokumen yang diperbarui sebelum besok malam?",
    emergency: "Permisi, saya membutuhkan bantuan mendesak. Saya tersesat dan tidak bisa berbicara bahasa lokal. Bisakah Anda menunjukkan arah ke rumah sakit terdekat?",
    casual: "Halo! Apa kabar? Kemarin malam kami pergi makan di restoran baru dekat alun-alun. Makanannya luar biasa, kamu harus coba!",
  },
  'ms': {
    travel: "Selamat pagi, saya ingin menempah bilik kembar untuk tiga malam. Adakah bilik kosong hujung minggu ini? Adakah harga termasuk sarapan?",
    business: "Mesyuarat telah ditangguhkan ke Khamis depan. Bolehkah anda mengesahkan ketersediaan anda dan menghantar dokumen terkini sebelum petang esok?",
    emergency: "Maafkan saya, saya memerlukan bantuan segera. Saya sesat dan tidak boleh bertutur bahasa tempatan. Bolehkah anda tunjukkan arah ke hospital terdekat?",
    casual: "Hai! Apa khabar? Malam tadi kami pergi makan di restoran baharu dekat dataran. Makanan sangat sedap, anda patut cuba!",
  },
  'cs': {
    travel: "Dobrý den, chtěl bych rezervovat dvoulůžkový pokoj na tři noci. Máte volné pokoje tento víkend? Je v ceně zahrnuta snídaně?",
    business: "Schůzka byla odložena na příští čtvrtek. Mohl byste potvrdit svou dostupnost a poslat aktualizované dokumenty do zítřejšího večera?",
    emergency: "Promiňte, potřebuji naléhavou pomoc. Ztratil jsem se a nemluvím místním jazykem. Mohl byste mi ukázat cestu k nejbližší nemocnici?",
    casual: "Ahoj! Jak se máš? Včera večer jsme šli do nové restaurace u náměstí. Jídlo bylo fantastické, měl bys to zkusit!",
  },
  'ro': {
    travel: "Bună dimineața, aș dori să rezerv o cameră dublă pentru trei nopți. Aveți disponibilitate în acest weekend? Prețul include micul dejun?",
    business: "Întâlnirea a fost amânată pentru joi viitoare. Puteți confirma disponibilitatea dumneavoastră și trimite documentele actualizate până mâine seară?",
    emergency: "Scuzați-mă, am nevoie de ajutor urgent. M-am rătăcit și nu vorbesc limba locală. Puteți să-mi arătați drumul către cel mai apropiat spital?",
    casual: "Salut! Ce faci? Aseară am fost la restaurantul nou de lângă piață. Mâncarea a fost fantastică, ar trebui să încerci!",
  },
  'hu': {
    travel: "Jó reggelt, szeretnék foglalni egy kétágyas szobát három éjszakára. Van szabad szobájuk ezen a hétvégén? Az ár tartalmazza a reggelit?",
    business: "A megbeszélést a jövő csütörtökre halasztották. Meg tudná erősíteni az elérhetőségét, és el tudná küldeni a frissített dokumentumokat holnap estig?",
    emergency: "Elnézést, sürgős segítségre van szükségem. Eltévedtem és nem beszélem a helyi nyelvet. Meg tudná mutatni az utat a legközelebbi kórházhoz?",
    casual: "Szia! Hogy vagy? Tegnap este mentünk az új étterembe a tér mellett. Az étel fantasztikus volt, ki kellene próbálnod!",
  },
  'fi': {
    travel: "Hyvää huomenta, haluaisin varata kahden hengen huoneen kolmeksi yöksi. Onko teillä vapaita huoneita tänä viikonloppuna? Sisältyykö hintaan aamiainen?",
    business: "Kokous on siirretty ensi torstaille. Voisitteko vahvistaa saatavuutenne ja lähettää päivitetyt asiakirjat huomiseen iltaan mennessä?",
    emergency: "Anteeksi, tarvitsen kiireellistä apua. Olen eksyksissä enkä puhu paikallista kieltä. Voisitteko näyttää tien lähimpään sairaalaan?",
    casual: "Hei! Mitä kuuluu? Eilen illalla kävimme syömässä siinä uudessa ravintolassa torin lähellä. Ruoka oli fantastista, sinun pitäisi kokeilla!",
  },
};

// Priority test pairs (most important language combinations to test)
export const PRIORITY_PAIRS = [
  { source: 'it', target: 'th' },
  { source: 'it', target: 'zh' },
  { source: 'it', target: 'ja' },
  { source: 'it', target: 'ko' },
  { source: 'it', target: 'ar' },
  { source: 'it', target: 'hi' },
  { source: 'en', target: 'th' },
  { source: 'en', target: 'zh' },
  { source: 'en', target: 'ja' },
  { source: 'en', target: 'ar' },
  { source: 'zh', target: 'ja' },
  { source: 'ko', target: 'ja' },
  { source: 'th', target: 'en' },
  { source: 'th', target: 'it' },
  { source: 'zh', target: 'en' },
  { source: 'ar', target: 'en' },
];

export const SCENARIOS = ['travel', 'business', 'emergency', 'casual'];
