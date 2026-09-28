# แผน: ปรับการแสดง Hermes และเพิ่ม Harness/Subscription

> สถานะ: แผนงานเท่านั้น ยังไม่มีการเปลี่ยนโค้ดหรือเชื่อมต่อบริการ

## เป้าหมาย

ปรับหน้า Sources ให้แสดงเฉพาะ Harness ที่มีแหล่งข้อมูลการใช้งานจริง เพิ่มแนวทางรองรับ Devin และ Factory Droid ในฐานะ Harness และเพิ่ม Command Code GOAT กับ Ollama Cloud ในฐานะ Subscription โดยไม่สร้างตัวเลข quota จากการคาดเดา

## ข้อเสนอและขอบเขต

| รายการ | ข้อเสนอ |
|---|---|
| Hermes → Claude Company, Claude Personal, Codex | ซ่อนและนำรายการ Delegate placeholder ออกจากการนำเสนอ ไม่รวม usage เข้ากับ `Hermes/default` |
| Devin, Factory Droid | เพิ่มเป็น Harness แยก โดยอ่านข้อมูลจาก CLI/session ที่ตรวจสอบรูปแบบได้ หรือใช้ wrapper แบบเลือกเปิดเมื่อไม่มี feed ในเครื่อง |
| Command Code GOAT, Ollama Cloud | เพิ่มเป็น Subscription เมื่อมีแหล่ง quota ของบัญชีที่เชื่อถือได้เท่านั้น |
| Ollama ที่รันในเครื่อง | ไม่ถือเป็น Ollama Cloud subscription และไม่แสดง quota ของ Cloud แทนการใช้งาน local |

## Hermes และ Delegate ที่แสดงอยู่

ปัจจุบัน `HARNESS_CATALOG` มี Hermes parent และ Delegate 3 รายการ ได้แก่ Codex CLI, Claude Code Company และ Claude Code Personal ส่วน `harnessStatus()` สร้างข้อมูล Delegate จาก catalog โดยไม่ได้ผูกกับ source row จริง ตัวเลข usage จึงอยู่บน Hermes parent อยู่แล้ว และ Delegate แสดงสถานะ parent-only ใน Sources

### แนวทาง

1. นำ Delegate placeholder ทั้งสามออกจาก catalog/API presentation หากตรวจแล้วไม่มี consumer อื่นที่ต้องใช้เพื่อคำนวณ attribution
2. เอาการ์ด Routes/Delegate ในหน้า Sources ออก พร้อมข้อความแปลและ icon import ที่ใช้เฉพาะส่วนนี้
3. ค้นหาและปรับ consumer อื่นที่อ่าน `parent_harness_key`, `delegate_keys` หรือ key ของ Hermes Delegate ให้ไม่แสดง placeholder หรือคาดหวังรายการเหล่านี้
4. คง Hermes, Codex CLI, Claude Code Company และ Claude Code Personal เป็น Harness/source แยกตามข้อมูลที่อ่านได้จริง รวมถึงคง Subscription ของแต่ละบัญชีแยกกัน
5. คง usage history และ source rows ที่บันทึกแล้วไว้ ไม่ย้ายหรือลบข้อมูลย้อนหลัง

**ไม่ควรรวม Delegate เข้ากับ Hermes/default:** การรวมจะทำให้แยกการใช้งานของ Hermes ออกจาก Codex/Claude Code โดยตรงได้ยาก และอาจทำให้การผูกบัญชีหรือการนับ usage ผิดเมื่อมีการ route ผ่านหลาย provider อยู่แล้ว การเอาการ์ด placeholder ออกไม่กระทบการ์ด Hermes หรือ usage source จริง

## เพิ่ม Devin และ Factory Droid เป็น Harness

เพิ่ม adapter แยกสำหรับแต่ละ Harness ตามสัญญา adapter ใน [`ADAPTER.md`](ADAPTER.md) โดยใช้ `UsageEvent` และ `SessionDim` แบบ canonical ที่มีอยู่ ไม่เพิ่มฟิลด์เฉพาะ vendor จนกว่าจะมีกรณีใช้งานที่ชัดเจน

- ตรวจสอบว่า CLI หรือ session store ในเครื่องเก็บข้อมูล usage แบบ structured และมี identifier ที่ใช้ deduplicate ได้หรือไม่ การไม่ติดตั้ง CLI ต้องตรวจพบได้โดยไม่ทำให้ adapter อื่นหยุดทำงาน
- รองรับรูปแบบ non-interactive ที่ผู้ใช้เรียกจริง เช่น Devin `-p` และ Droid `exec` เฉพาะเมื่อรูปแบบ output มี usage fields ที่ยืนยันได้ ถ้าเก็บข้อมูลต่อ turn ได้ให้ใช้ข้อมูลนั้นก่อน
- ถ้าไม่มีไฟล์/feed ในเครื่องที่เชื่อถือได้ ให้พิจารณา wrapper แบบ opt-in สำหรับคำสั่งที่ผู้ใช้เรียกเองเท่านั้น Wrapper ต้องส่งต่อ argv, stdout, stderr และ exit code โดยไม่เปลี่ยนพฤติกรรมคำสั่ง และต้องไม่เปิด session หรือส่ง prompt เพิ่มเอง
- หากต้องมี event stream สำหรับ wrapper ให้กำหนด schema สำหรับ usage แยกและ versioned อย่าใส่ usage ลงใน quota event stream ปัจจุบันซึ่งออกแบบมาสำหรับ quota windows
- เก็บเฉพาะจำนวน calls/tokens, model/provider, timestamp, session metadata และ native cost เมื่อ Harness รายงานค่าที่เชื่อถือได้ ไม่เก็บ prompt, response, tool I/O, credentials หรือเนื้อหาไฟล์
- ยังไม่แปลง Devin ACU/credits หรือ Factory Service Credits ให้เป็น token/cost โดยประมาณ ให้แสดงเฉพาะ metric ที่ตรงกับ schema ปัจจุบันและมีความหมายตรงกัน

## เพิ่ม Command Code GOAT และ Ollama Cloud เป็น Subscription

การแสดง Subscription ต้องอาศัย quota ของบัญชีจาก provider reader หรือ structured quota feed ที่เชื่อถือได้เท่านั้น ห้ามใช้ transcript หรือ usage บนเครื่องคำนวณเป็นสัดส่วน quota ของทั้งบัญชี

- **Command Code GOAT:** ตรวจสอบแหล่งข้อมูลอย่างเป็นทางการสำหรับหน้าต่าง 5 ชั่วโมง, รายสัปดาห์ และรายเดือนก่อนกำหนด mapping เข้ากับ `WindowKind` ที่รองรับ
- **Ollama Cloud:** ตรวจสอบการอ่าน quota/credits รายเดือนของ Cloud แยกจาก Ollama ที่รันในเครื่อง การใช้งาน local ไม่ได้พิสูจน์ยอดหรือสิทธิ์ของบัญชี Cloud
- แยกการจัดการ credentials ไว้ใน helper ของ provider ตามแนวทาง privacy เดิม ให้ daemon รับเฉพาะค่าที่ sanitize แล้ว ห้ามเก็บ token ใน DB, log หรือ API
- ถ้ายังไม่มี endpoint/feed ที่รองรับและเชื่อถือได้ ให้เลื่อนการแสดงการ์ด subscription ของ provider นั้นออกไปก่อน ห้ามแสดง quota ปลอม ค่า 0 หรือคาดการณ์จาก usage ในเครื่อง

## ลำดับการทำงานเมื่อเริ่ม implementation

1. ค้นทุก consumer ของ Delegate catalog/API และข้อความ Sources ก่อนลบรายการ เพื่อตรวจว่าไม่มี attribution หรือ API contract อื่นพึ่งพาอยู่
2. ทำความสะอาด Hermes presentation โดยไม่เปลี่ยน adapter, source identity หรือประวัติ usage
3. สำรวจตัวอย่าง output/session metadata ของ Devin และ Factory Droid ในโหมดที่ผู้ใช้เรียกจริง แล้วบันทึก measurement และข้อจำกัดใน `DATA-SOURCES.md`
4. เลือกแหล่ง ingest ที่ปลอดภัยและทำซ้ำได้สำหรับแต่ละ Harness; เพิ่ม wrapper แบบ opt-in เฉพาะเมื่ออ่านข้อมูลที่มีอยู่ไม่ได้
5. ตรวจสอบ official quota source และการยืนยันตัวตนของ GOAT/Ollama Cloud หากยังไม่มีแหล่งที่เหมาะสม ให้พัก provider นั้นโดยไม่เพิ่มการ์ด
6. เพิ่ม catalog, provider reader, dashboard display และเอกสาร privacy ตามผลการตรวจสอบ พร้อมทดสอบ dedup, restart/partial data, absence, malformed input และการไม่มี quota source

## เกณฑ์รับงาน

- ไม่มีการ์ด Hermes Delegate หรือข้อความ Routes ที่สื่อว่ามีข้อมูล route-level ทั้งที่ไม่มี source จริง
- การ์ด Hermes, Codex CLI และ Claude Code Company/Personal รวมถึง usage history ยังแยกจากกัน
- Devin และ Factory Droid ตรวจพบและ ingest ได้โดยไม่อ่านเนื้อหา session; การ ingest ซ้ำไม่เพิ่ม usage ซ้ำ
- Wrapper เป็นแบบ opt-in, pass-through และบันทึกเฉพาะ structured usage metadata
- GOAT และ Ollama Cloud แสดง quota เฉพาะเมื่อ reader/feed ให้ค่าจากบัญชีที่มี timestamp/window ที่ตรวจสอบได้; ไม่มีข้อมูลแล้วไม่สร้างตัวเลขทดแทน
- Ollama local ไม่ถูกนับเป็น Cloud subscription และไม่มีการประมาณ ACU/Service Credits เป็น tokens หรือ USD

## ข้อจำกัดและสิ่งที่ยังต้องยืนยัน

- รูปแบบ output และวิธีอ่าน session ของ Devin/Factory Droid อาจเปลี่ยนตามรุ่น ต้องยืนยันกับข้อมูลจริงก่อนเลือก adapter path
- การมีหน้า usage ใน dashboard ของ provider ไม่ได้แปลว่ามี API หรือ feed ที่เหมาะกับการอ่านโดย QuotaPulse หากต้องใช้วิธีที่เปราะบางหรืออ่านข้อมูลรับรองโดยตรง ให้พัก integration จนกว่าจะมีแนวทางที่รองรับ
- ไม่คาดว่าจะต้องเปลี่ยน canonical schema สำหรับ token/cost/quota windows แต่ต้องยืนยันอีกครั้งหลังสำรวจ data source จริง
- แผนนี้ไม่ครอบคลุมการรวมบัญชี Claude/Codex เข้ากับ Hermes, การดึงประวัติ cloud usage ย้อนหลัง, การเก็บ transcript หรือการแปลงหน่วยเครดิตเป็นเงิน/token

## เอกสารอ้างอิงเบื้องต้น

ควรตรวจเอกสารทางการเหล่านี้ซ้ำก่อนเริ่ม implementation เพราะรายละเอียด CLI และ quota อาจเปลี่ยนได้:

- [Devin CLI commands](https://docs.devin.ai/cli/reference/commands) และ [Devin usage and limits](https://docs.devin.ai/admin/billing/usage)
- [Factory Droid SDK](https://docs.factory.ai/sdk/typescript) และ [Droid Exec](https://docs.factory.ai/droid-exec/overview)
- [Command Code usage limits](https://commandcode.ai/docs/resources/usage-limits)
- [Ollama Cloud pricing](https://www.ollama.com/pricing) และ [Ollama API usage](https://docs.ollama.com/api/usage)
