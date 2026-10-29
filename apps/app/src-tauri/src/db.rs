// SQLite local de FarmHabit. Expone tres comandos (select, execute y
// transaction) que implementan la interfaz SqlDriver del núcleo. Se usa
// rusqlite con una única conexión protegida por un Mutex: así cada
// transacción es atómica de verdad (plugin-sql usa un pool y no lo garantiza).

use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::{params_from_iter, Connection};
use serde::Deserialize;
use serde_json::{Map, Value};
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

pub struct Db(Mutex<Connection>);

impl Db {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        // Sobrescribir con ceros lo borrado: el texto de una nota que se hace
        // privada no puede quedar en páginas libres del archivo.
        conn.pragma_update(None, "secure_delete", "ON")?;
        Ok(Db(Mutex::new(conn)))
    }
}

#[derive(Deserialize)]
pub struct Statement {
    sql: String,
    #[serde(default)]
    params: Vec<Value>,
}

fn to_sql(value: &Value) -> Result<SqlValue, String> {
    match value {
        Value::Null => Ok(SqlValue::Null),
        Value::Bool(b) => Ok(SqlValue::Integer(i64::from(*b))),
        Value::Number(n) => match n.as_i64() {
            Some(i) => Ok(SqlValue::Integer(i)),
            None => n
                .as_f64()
                .map(SqlValue::Real)
                .ok_or_else(|| "número no válido".to_string()),
        },
        Value::String(s) => Ok(SqlValue::Text(s.clone())),
        _ => Err("tipo de parámetro no soportado".to_string()),
    }
}

fn to_params(values: &[Value]) -> Result<Vec<SqlValue>, String> {
    values.iter().map(to_sql).collect()
}

fn from_sql(value: ValueRef<'_>) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::from(i),
        ValueRef::Real(f) => Value::from(f),
        ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        // El esquema no usa BLOB.
        ValueRef::Blob(_) => Value::Null,
    }
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub fn db_select(
    db: State<'_, Db>,
    sql: String,
    params: Vec<Value>,
) -> Result<Vec<Map<String, Value>>, String> {
    let conn = db.0.lock().map_err(err)?;
    let mut stmt = conn.prepare(&sql).map_err(err)?;
    let names: Vec<String> = stmt.column_names().map(|s| s.to_string()).collect();
    let mut rows = stmt
        .query(params_from_iter(to_params(&params)?))
        .map_err(err)?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(err)? {
        let mut obj = Map::with_capacity(names.len());
        for (i, name) in names.iter().enumerate() {
            obj.insert(name.clone(), from_sql(row.get_ref(i).map_err(err)?));
        }
        out.push(obj);
    }
    Ok(out)
}

#[tauri::command]
pub fn db_execute(db: State<'_, Db>, sql: String, params: Vec<Value>) -> Result<usize, String> {
    let conn = db.0.lock().map_err(err)?;
    conn.execute(&sql, params_from_iter(to_params(&params)?))
        .map_err(err)
}

#[tauri::command]
pub fn db_transaction(db: State<'_, Db>, statements: Vec<Statement>) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(err)?;
    let tx = conn.transaction().map_err(err)?;
    for s in &statements {
        tx.execute(&s.sql, params_from_iter(to_params(&s.params)?))
            .map_err(err)?;
    }
    // Si algo falla antes, `tx` se descarta y hace rollback automáticamente.
    tx.commit().map_err(err)
}
