#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{thread, time::Duration};
use std::fs;
use tauri::{Manager, Emitter};
use device_query::{DeviceQuery, DeviceState};

// --- ESTRUCTURAS DE DATOS ---

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
}

#[derive(Serialize, Deserialize)]
struct PerfilUsuario {
    calorias_diarias: u32,
    horas_maximas: u32,
    calorias_consumidas: u32,
}

// --- COMANDOS DE MEMORIA (PERFIL) ---

#[tauri::command]
fn obtener_perfil() -> PerfilUsuario {
    if let Ok(data) = fs::read_to_string("perfil.json") {
        if let Ok(perfil) = serde_json::from_str(&data) {
            return perfil;
        }
    }
    PerfilUsuario {
        calorias_diarias: 2200,
        horas_maximas: 4,
        calorias_consumidas: 0,
    }
}

#[tauri::command]
fn guardar_perfil(perfil: PerfilUsuario) -> Result<String, String> {
    let json = serde_json::to_string(&perfil).map_err(|e| e.to_string())?;
    fs::write("perfil.json", json).map_err(|e| e.to_string())?;
    Ok("Perfil guardado con éxito".to_string())
}

#[tauri::command]
fn registrar_comida(calorias: u32) -> Result<String, String> {
    let mut perfil = obtener_perfil();
    perfil.calorias_consumidas += calorias;
    
    let json = serde_json::to_string(&perfil).map_err(|e| e.to_string())?;
    fs::write("perfil.json", json).map_err(|e| e.to_string())?;
    
    Ok(format!("Registro médico actualizado. Total ingerido hoy: {} kcal.", perfil.calorias_consumidas))
}

// --- COMANDO DEL CEREBRO (PLAN B: API LOCAL) ---

#[tauri::command]
async fn procesar_mensaje(mensaje: String, modo: String) -> Result<String, String> {
    let cliente = reqwest::Client::new();
    let perfil = obtener_perfil(); 
    
    let contexto = if modo == "sencillo" {
        "Eres un agente médico local anónimo. Tu directriz estricta está basada en la Cruz Roja y la AHA. El usuario está en 'Modo Sencillo'. Recomienda pausas activas, cuidado visual y estiramientos para evitar el sedentarismo tras 1 hora de trabajo continuo. Sé clínico, breve y directo.".to_string()
    } else {
        let restantes = if perfil.calorias_diarias > perfil.calorias_consumidas {
            perfil.calorias_diarias - perfil.calorias_consumidas
        } else {
            0 
        };
        
        format!(
            "Eres un agente nutricional local. Tu directriz estricta está basada en la Asociación Americana del Corazón (AHA). El usuario está en 'Modo Avanzado'. Meta diaria: {} kcal. Consumidas hoy: {} kcal. Le faltan {} kcal. Analiza su último comentario y dale recomendaciones clínicas para equilibrar su dieta. Sé conciso y directo.", 
            perfil.calorias_diarias, perfil.calorias_consumidas, restantes
        )
    };

    let prompt_completo = format!(
        "{} El usuario dice: '{}'. Dame una respuesta médica corta de máximo 2 oraciones.", 
        contexto, mensaje
    );

    let peticion = OllamaRequest {
        model: "gemma2:2b".to_string(), // El modelo ligero local
        prompt: prompt_completo,
        stream: false,
    };

    let res = cliente.post("http://localhost:11434/api/generate")
        .json(&peticion)
        .send()
        .await
        .map_err(|e| format!("Error conectando a la API local: {}", e))?;

    let body: OllamaResponse = res.json().await.map_err(|e| format!("Error leyendo JSON: {}", e))?;
    
    Ok(body.response)
}

// --- FUNCIÓN PRINCIPAL Y DETECTOR DE HARDWARE ---

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            thread::spawn(move || {
                let device_state = DeviceState::new();
                let mut ultima_posicion = device_state.get_mouse().coords;
                
                let mut tiempo_trabajando = 0; 
                let mut tiempo_inactivo = 0;   

                loop {
                    thread::sleep(Duration::from_secs(2));
                    
                    let posicion_actual = device_state.get_mouse().coords;
                    let teclas = device_state.get_keys();

                    let hubo_actividad = posicion_actual != ultima_posicion || !teclas.is_empty();

                    if hubo_actividad {
                        tiempo_trabajando += 2;
                        tiempo_inactivo = 0; 
                        ultima_posicion = posicion_actual;
                    } else {
                        tiempo_inactivo += 2; 
                    }

                    if tiempo_inactivo >= 300 {
                        tiempo_trabajando = 0;
                    }

                    // Para pruebas rápidas está en 60. Puedes subirlo a 3600 para que sea 1 hora real.
                    if tiempo_trabajando >= 60 && hubo_actividad {
                        app_handle.emit("alerta-descanso", "🤖 Agente Clínico: Exposición prolongada detectada. Sugiero pausa activa inmediata para liberar tensión cervical y lumbar.").unwrap();
                        tiempo_trabajando = 0; 
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![procesar_mensaje, obtener_perfil, guardar_perfil, registrar_comida])
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación tauri");
}