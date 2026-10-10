//! Gather's authoritative local-demo workflow. No network or filesystem access.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

pub const MAX_FILE: usize = 2 * 1024 * 1024;
pub const MAX_TOTAL: usize = 6 * 1024 * 1024;
pub const MAX_INPUT: usize = 12 * 1024 * 1024;
pub const MAX_ITEMS: usize = 12;
const FORMATS: [&str; 7] = ["txt", "md", "json", "pdf", "png", "jpg", "jpeg"];

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Missing,
    Submitted,
    Accepted,
    ChangesRequested,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Requirement {
    pub title: String,
    pub instructions: String,
    pub formats: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct File {
    pub name: String,
    pub content: String,
    pub size: usize,
    pub sha256: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Item {
    pub id: u32,
    pub requirement: Requirement,
    pub status: Status,
    pub version: u32,
    pub file: Option<File>,
    pub feedback: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Event {
    pub revision: u32,
    pub message: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct State {
    pub schema: u32,
    pub project_id: String,
    pub title: String,
    pub client: String,
    pub revision: u32,
    pub items: Vec<Item>,
    pub activity: Vec<Event>,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum Command {
    Create {
        project_id: String,
        title: String,
        client: String,
        requirements: Vec<Requirement>,
    },
    Sample {},
    Validate {},
    Submit {
        item_id: u32,
        name: String,
        content: String,
    },
    Accept {
        item_id: u32,
        version: u32,
    },
    RequestChanges {
        item_id: u32,
        version: u32,
        feedback: String,
    },
    Export {
        include_files: bool,
    },
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub state: Option<State>,
    pub expected_revision: Option<u32>,
    pub command: Command,
}

type Result<T> = std::result::Result<T, String>;
fn clean(s: &str, max: usize, label: &str) -> Result<()> {
    if s.trim().is_empty()
        || s.chars().count() > max
        || s.chars().any(|c| c.is_control() && c != '\n' && c != '\t')
    {
        return Err(format!("{label} must contain 1–{max} readable characters."));
    }
    Ok(())
}
fn check_req(r: &Requirement) -> Result<()> {
    clean(&r.title, 80, "Item title")?;
    clean(&r.instructions, 600, "Instructions")?;
    if r.formats.is_empty()
        || r.formats.len() > FORMATS.len()
        || r.formats.iter().any(|x| !FORMATS.contains(&x.as_str()))
    {
        return Err("Choose supported file formats for every item.".into());
    }
    let mut sorted = r.formats.clone();
    sorted.sort();
    sorted.dedup();
    if sorted.len() != r.formats.len() {
        return Err("Duplicate formats are not allowed.".into());
    }
    Ok(())
}
fn check_filename(name: &str) -> Result<&str> {
    if name.is_empty()
        || name.len() > 120
        || name.starts_with('.')
        || name.trim() != name
        || name.contains("..")
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-_. ()".contains(c))
    {
        return Err("Use a filename of 1–120 simple letters, numbers, spaces, dots, dashes or underscores, with no paths.".into());
    }
    name.rsplit_once('.')
        .map(|(_, ext)| ext)
        .ok_or_else(|| "The file needs a supported extension.".into())
}
fn decode_file(name: &str, content: &str, formats: &[String]) -> Result<Vec<u8>> {
    let ext = check_filename(name)?.to_ascii_lowercase();
    if !formats.contains(&ext) {
        return Err(format!("This item accepts {} files.", formats.join(", ")));
    }
    if content.len() > MAX_FILE.div_ceil(3) * 4 {
        return Err("Each file must be no larger than 2 MiB.".into());
    }
    let bytes = STANDARD
        .decode(content)
        .map_err(|_| "The file bytes are not valid base64.".to_string())?;
    if bytes.is_empty() || bytes.len() > MAX_FILE {
        return Err("Choose a nonempty file no larger than 2 MiB.".into());
    }
    match ext.as_str() {
        "txt" | "md" | "json" => {
            let text = std::str::from_utf8(&bytes)
                .map_err(|_| "Text files must use UTF-8.".to_string())?;
            if text.contains('\0') {
                return Err("Text files cannot contain null bytes.".into());
            }
            if ext == "json" {
                serde_json::from_str::<Value>(text)
                    .map_err(|_| "The JSON file is not valid bounded JSON.".to_string())?;
            }
        }
        "png" if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") => {
            return Err("The PNG signature does not match the extension.".into())
        }
        "jpg" | "jpeg" if !bytes.starts_with(&[255, 216, 255]) => {
            return Err("The JPEG signature does not match the extension.".into())
        }
        "pdf" if !bytes.starts_with(b"%PDF-") => {
            return Err("The PDF signature does not match the extension.".into())
        }
        _ => (),
    }
    Ok(bytes)
}
fn hash(b: &[u8]) -> String {
    format!("{:x}", Sha256::digest(b))
}
fn validate(s: &State) -> Result<()> {
    if s.schema != 1 || s.revision == 0 || s.revision >= 1_000_000 {
        return Err("Unsupported or exhausted packet revision.".into());
    }
    if s.project_id.len() < 3
        || s.project_id.len() > 80
        || !s
            .project_id
            .chars()
            .all(|x| x.is_ascii_alphanumeric() || x == '-')
    {
        return Err("Invalid local packet identity.".into());
    }
    clean(&s.title, 100, "Project title")?;
    clean(&s.client, 80, "Client label")?;
    if s.items.is_empty() || s.items.len() > MAX_ITEMS {
        return Err("A packet needs 1–12 items.".into());
    }
    if s.activity.len() > 50 {
        return Err("The activity history is too large.".into());
    }
    let mut size = 0;
    for (n, i) in s.items.iter().enumerate() {
        if i.id as usize != n + 1 {
            return Err("Item identities are inconsistent.".into());
        }
        check_req(&i.requirement)?;
        if i.version > s.revision {
            return Err("Invalid item version.".into());
        }
        match (&i.status, &i.file) {
            (Status::Missing, None) if i.version == 0 && i.feedback.is_empty() => (),
            (Status::Missing, _) | (_, None) => {
                return Err("File and review status are inconsistent.".into())
            }
            (_, Some(f)) => {
                if i.version == 0 {
                    return Err("A submitted file needs a version.".into());
                }
                let bytes = decode_file(&f.name, &f.content, &i.requirement.formats)?;
                if bytes.len() != f.size || hash(&bytes) != f.sha256 {
                    return Err("Stored file bytes do not match their manifest. Reset the demo or restore a known-good copy.".into());
                }
                size += bytes.len();
                if i.status == Status::ChangesRequested {
                    clean(&i.feedback, 500, "Revision feedback")?;
                } else if !i.feedback.is_empty() {
                    return Err("Unexpected review feedback.".into());
                }
            }
        }
    }
    if size > MAX_TOTAL {
        return Err("This local packet supports at most 6 MiB of files.".into());
    }
    let mut last = 0;
    for e in &s.activity {
        clean(&e.message, 200, "Activity")?;
        if e.revision <= last || e.revision > s.revision {
            return Err("Invalid activity revisions.".into());
        }
        last = e.revision;
    }
    Ok(())
}
fn event(s: &mut State, message: String) {
    s.revision += 1;
    s.activity.push(Event {
        revision: s.revision,
        message,
    });
    if s.activity.len() > 50 {
        s.activity.remove(0);
    }
}
fn create(
    project_id: String,
    title: String,
    client: String,
    requirements: Vec<Requirement>,
) -> Result<State> {
    let s = State {
        schema: 1,
        project_id,
        title: title.trim().into(),
        client: client.trim().into(),
        revision: 1,
        items: requirements
            .into_iter()
            .enumerate()
            .map(|(n, requirement)| Item {
                id: (n + 1) as u32,
                requirement,
                status: Status::Missing,
                version: 0,
                file: None,
                feedback: String::new(),
            })
            .collect(),
        activity: vec![Event {
            revision: 1,
            message: "Packet created. Ready to collect assets.".into(),
        }],
    };
    validate(&s)?;
    Ok(s)
}
fn transition(s: &mut State, command: Command) -> Result<()> {
    match command {
        Command::Submit {
            item_id,
            name,
            content,
        } => {
            let i = s
                .items
                .iter_mut()
                .find(|i| i.id == item_id)
                .ok_or("This item no longer exists.")?;
            if !matches!(i.status, Status::Missing | Status::ChangesRequested) {
                return Err(
                    "This version is already submitted. Ask for changes before replacing it."
                        .into(),
                );
            }
            let bytes = decode_file(&name, &content, &i.requirement.formats)?;
            i.file = Some(File {
                name,
                size: bytes.len(),
                sha256: hash(&bytes),
                content,
            });
            i.version += 1;
            i.status = Status::Submitted;
            i.feedback.clear();
            let msg = format!(
                "{} · version {} submitted for review",
                i.requirement.title, i.version
            );
            event(s, msg);
        }
        Command::Accept { item_id, version } => {
            let i = s
                .items
                .iter_mut()
                .find(|i| i.id == item_id)
                .ok_or("This item no longer exists.")?;
            if i.version != version || i.status != Status::Submitted {
                return Err("That review is stale or already resolved. Review the current submitted version.".into());
            }
            i.status = Status::Accepted;
            let msg = format!("{} · version {} accepted", i.requirement.title, i.version);
            event(s, msg);
        }
        Command::RequestChanges {
            item_id,
            version,
            feedback,
        } => {
            clean(&feedback, 500, "Revision feedback")?;
            let i = s
                .items
                .iter_mut()
                .find(|i| i.id == item_id)
                .ok_or("This item no longer exists.")?;
            if i.version != version || !matches!(i.status, Status::Submitted | Status::Accepted) {
                return Err(
                    "That review is stale or already resolved. Review the current version.".into(),
                );
            }
            i.status = Status::ChangesRequested;
            i.feedback = feedback.trim().into();
            let msg = format!(
                "{} · changes requested for version {}",
                i.requirement.title, i.version
            );
            event(s, msg);
        }
        _ => return Err("This command does not change an item.".into()),
    }
    validate(s)
}
fn sample() -> Result<State> {
    let specs = [
        ("Brand guidelines", "Your brand's colours, fonts and tone of voice. A PDF or plain-text brand guide is perfect.", vec!["pdf", "txt"]),
        ("Primary logo", "A high-resolution PNG or JPEG, or a text note describing the placeholder logo for this demo.", vec!["png", "jpg", "jpeg", "txt"]),
        ("Website copy", "Final homepage and about-page copy. Include headings and calls to action.", vec!["txt", "md"]),
        ("Team photography", "One approved PNG or JPEG. Use a text shot list while trying this local demo.", vec!["png", "jpg", "jpeg", "txt"]),
        ("Project details", "A short brief with the site's goals, audience and important launch notes.", vec!["txt", "json"])
    ];
    let reqs = specs
        .into_iter()
        .map(|(a, b, c)| Requirement {
            title: a.into(),
            instructions: b.into(),
            formats: c.into_iter().map(String::from).collect(),
        })
        .collect();
    let mut s = create(
        "gather-sample-1".into(),
        "A little closer to launch.".into(),
        "Fern & Field Studio".into(),
        reqs,
    )?;
    for (id,name,text) in [(1,"brand-guide.txt","SYNTHETIC DEMO ASSET\nFern & Field\nForest green and warm cream. Editorial, kind, clear.\n"), (2,"logo-notes.txt","SYNTHETIC DEMO ASSET\nWordmark: Fern & Field. Placeholder text, not a finished logo.\n"), (3,"homepage-copy.txt","SYNTHETIC DEMO ASSET\nSpaces for slower living.\nThoughtful objects. Naturally made.\nExplore the collection.\n"), (4,"photo-shot-list.txt","SYNTHETIC DEMO ASSET\nPortrait of the two founders.\nNeeds an approved image before the real project can proceed.\n")] {
        transition(&mut s, Command::Submit { item_id:id, name:name.into(), content:STANDARD.encode(text) })?;
        if id < 3 { transition(&mut s, Command::Accept { item_id:id, version:1 })?; }
    }
    transition(&mut s, Command::RequestChanges { item_id:4, version:1, feedback:"Please use the final colour portrait, or submit an updated shot list to try the revision flow.".into() })?;
    Ok(s)
}
fn export(s: &State, files: bool) -> Value {
    let accepted: Vec<Value> = s.items.iter().filter(|i| i.status == Status::Accepted).map(|i| {
        let f = i.file.as_ref().expect("validated file");
        let mut row = json!({"item_id":i.id,"requirement":i.requirement.title,"version":i.version,"name":format!("{:02}-{}",i.id,f.name),"original_name":f.name,"bytes":f.size,"sha256":f.sha256});
        if files { row["content_base64"] = json!(f.content); }
        row
    }).collect();
    json!({"format":"gather-accepted-packet-v1","local_demo":true,"project":s.title,"client":s.client,"project_id":s.project_id,"revision":s.revision,"complete":accepted.len()==s.items.len(),"accepted_count":accepted.len(),"required_count":s.items.len(),"contains_file_bytes":files,"hash_algorithm":"SHA-256","notice":"Local demo record; review is not authenticated or digitally signed. File signatures are preliminary checks, not malware scanning. Only accepted versions are included.","files":accepted})
}
pub fn handle(req: Request) -> Result<Value> {
    match req.command {
        Command::Sample {} => return Ok(json!({"state":sample()?})),
        Command::Create {
            project_id,
            title,
            client,
            requirements,
        } => return Ok(json!({"state":create(project_id,title,client,requirements)?})),
        _ => (),
    }
    let mut s = req.state.ok_or("No packet is open.")?;
    validate(&s)?;
    if req.expected_revision != Some(s.revision) {
        return Err("This packet changed. Reload its current version before continuing.".into());
    }
    match req.command {
        Command::Validate {} => Ok(json!({"state":s})),
        Command::Export { include_files } => Ok(json!({"export":export(&s,include_files)})),
        command => {
            transition(&mut s, command)?;
            Ok(json!({"state":s}))
        }
    }
}
pub fn execute(input: &[u8]) -> Vec<u8> {
    let result = if input.len() > MAX_INPUT {
        Err("Request exceeds the 12 MiB processing limit.".into())
    } else {
        serde_json::from_slice::<Request>(input)
            .map_err(|_| "Invalid request or unsupported fields.".into())
            .and_then(handle)
    };
    serde_json::to_vec(&match result {
        Ok(v) => json!({"ok":true,"data":v}),
        Err(e) => json!({"ok":false,"error":e}),
    })
    .unwrap()
}

// Single-buffer ABI: callers cannot supply arbitrary pointers for execute/free.
// Browser glue copies input into the bounded owned buffer, then reads output.
#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    use std::cell::RefCell;
    thread_local! { static INPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) }; static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) }; }
    #[no_mangle]
    pub extern "C" fn input_buffer(len: usize) -> *mut u8 {
        if len > MAX_INPUT {
            INPUT.with(|b| b.borrow_mut().clear());
            return std::ptr::null_mut();
        }
        INPUT.with(|b| {
            let mut b = b.borrow_mut();
            b.resize(len, 0);
            b.as_mut_ptr()
        })
    }
    #[no_mangle]
    pub extern "C" fn execute_request() {
        let result = INPUT.with(|b| execute(&b.borrow()));
        OUTPUT.with(|b| *b.borrow_mut() = result);
    }
    #[no_mangle]
    pub extern "C" fn output_buffer() -> *const u8 {
        OUTPUT.with(|b| b.borrow().as_ptr())
    }
    #[no_mangle]
    pub extern "C" fn output_len() -> usize {
        OUTPUT.with(|b| b.borrow().len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn run(s: State, c: Command) -> Result<Value> {
        let rev = s.revision;
        handle(Request {
            state: Some(s),
            expected_revision: Some(rev),
            command: c,
        })
    }
    #[test]
    fn sample_workflow_and_export() {
        let s = sample().unwrap();
        let e = export(&s, true);
        assert_eq!(e["accepted_count"], 2);
        assert_eq!(e["files"].as_array().unwrap().len(), 2);
        assert_eq!(e["complete"], false);
        for f in e["files"].as_array().unwrap() {
            assert_eq!(
                hash(
                    &STANDARD
                        .decode(f["content_base64"].as_str().unwrap())
                        .unwrap()
                ),
                f["sha256"]
            );
        }
    }
    #[test]
    fn accept_is_not_repeatable() {
        let s = sample().unwrap();
        let next = run(
            s,
            Command::Accept {
                item_id: 3,
                version: 1,
            },
        )
        .unwrap();
        let s: State = serde_json::from_value(next["state"].clone()).unwrap();
        assert!(run(
            s,
            Command::Accept {
                item_id: 3,
                version: 1
            }
        )
        .is_err());
    }
    #[test]
    fn rejected_file_resubmits_new_version() {
        let s = sample().unwrap();
        let next = run(
            s,
            Command::Submit {
                item_id: 4,
                name: "revised.txt".into(),
                content: STANDARD.encode("New shot list"),
            },
        )
        .unwrap();
        let s: State = serde_json::from_value(next["state"].clone()).unwrap();
        assert_eq!(s.items[3].version, 2);
        assert!(s.items[3].feedback.is_empty());
        assert!(run(
            s.clone(),
            Command::Accept {
                item_id: 4,
                version: 1
            }
        )
        .is_err());
        assert!(run(
            s,
            Command::Accept {
                item_id: 4,
                version: 2
            }
        )
        .is_ok());
    }
    #[test]
    fn stale_revision_rejected() {
        let s = sample().unwrap();
        assert!(handle(Request {
            expected_revision: Some(s.revision - 1),
            state: Some(s),
            command: Command::Validate {}
        })
        .is_err());
    }
    #[test]
    fn cannot_replace_accepted() {
        assert!(run(
            sample().unwrap(),
            Command::Submit {
                item_id: 1,
                name: "replacement.txt".into(),
                content: STANDARD.encode("replacement")
            }
        )
        .is_err());
    }
    #[test]
    fn reopening_excludes_export() {
        let s = sample().unwrap();
        let v = run(
            s,
            Command::RequestChanges {
                item_id: 1,
                version: 1,
                feedback: "Please update the colours.".into(),
            },
        )
        .unwrap();
        let s: State = serde_json::from_value(v["state"].clone()).unwrap();
        assert_eq!(export(&s, false)["accepted_count"], 1);
    }
    #[test]
    fn invalid_names_rejected() {
        for n in [
            "../a.txt", "a/b.txt", "a\\b.txt", ".a.txt", "a..txt", "a.txt\n", "☃.txt", "a",
        ] {
            assert!(
                decode_file(n, &STANDARD.encode("x"), &["txt".into()]).is_err(),
                "{n}"
            );
        }
    }
    #[test]
    fn extension_and_content_checks() {
        let f = vec!["txt".into(), "png".into(), "pdf".into(), "json".into()];
        for (n, c) in [
            ("x.html", "x"),
            ("x.png", "not a PNG"),
            ("x.pdf", "not a PDF"),
            ("x.json", "{broken"),
            ("x.txt", "\0"),
        ] {
            assert!(decode_file(n, &STANDARD.encode(c), &f).is_err());
        }
        assert!(decode_file("okay.TXT", &STANDARD.encode("hello"), &f).is_ok());
    }
    #[test]
    fn empty_oversized_and_invalid_base64_rejected() {
        for c in [
            String::new(),
            "%%%".into(),
            STANDARD.encode(vec![1; MAX_FILE + 1]),
        ] {
            assert!(decode_file("x.txt", &c, &["txt".into()]).is_err());
        }
    }
    #[test]
    fn bad_state_tampering_rejected() {
        let mut s = sample().unwrap();
        s.items[0].file.as_mut().unwrap().content = STANDARD.encode("edited");
        assert!(validate(&s).is_err());
        let mut s = sample().unwrap();
        s.items[0].status = Status::Missing;
        assert!(validate(&s).is_err());
    }
    #[test]
    fn feedback_required() {
        assert!(run(
            sample().unwrap(),
            Command::RequestChanges {
                item_id: 3,
                version: 1,
                feedback: "  ".into()
            }
        )
        .is_err());
    }
    #[test]
    fn packet_limits() {
        let s = sample().unwrap();
        assert!(create("abc".into(), "x".into(), "y".into(), vec![]).is_err());
        assert!(create(
            "abc".into(),
            "x".into(),
            "y".into(),
            vec![s.items[0].requirement.clone(); 13]
        )
        .is_err());
        let mut s = create(
            "abc".into(),
            "x".into(),
            "y".into(),
            vec![s.items[0].requirement.clone(); 4],
        )
        .unwrap();
        for i in 1..=3 {
            transition(
                &mut s,
                Command::Submit {
                    item_id: i,
                    name: "x.txt".into(),
                    content: STANDARD.encode(vec![b'a'; MAX_FILE]),
                },
            )
            .unwrap();
        }
        assert!(run(
            s,
            Command::Submit {
                item_id: 4,
                name: "x.txt".into(),
                content: STANDARD.encode("a")
            }
        )
        .is_err());
    }
    #[test]
    fn invalid_json_and_oversized_request() {
        for bytes in [
            b"oops".to_vec(),
            vec![b' '; MAX_INPUT + 1],
            br#"{"state":null,"expected_revision":null,"command":{"op":"sample","extra":true}}"#
                .to_vec(),
        ] {
            let r: Value = serde_json::from_slice(&execute(&bytes)).unwrap();
            assert_eq!(r["ok"], false);
        }
    }
    #[test]
    fn sha_known_vector() {
        assert_eq!(
            hash(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
    #[test]
    fn complete_packet_exports_all() {
        let mut s = sample().unwrap();
        transition(
            &mut s,
            Command::Accept {
                item_id: 3,
                version: 1,
            },
        )
        .unwrap();
        for id in [4, 5] {
            transition(
                &mut s,
                Command::Submit {
                    item_id: id,
                    name: "done.txt".into(),
                    content: STANDARD.encode("done"),
                },
            )
            .unwrap();
            let v = s.items[(id - 1) as usize].version;
            transition(
                &mut s,
                Command::Accept {
                    item_id: id,
                    version: v,
                },
            )
            .unwrap();
        }
        assert_eq!(export(&s, true)["complete"], true);
    }
}
