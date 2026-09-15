export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auditoria_log: {
        Row: {
          accion: string
          id: string
          ocurrido_en: string
          persona_id: string | null
          registro_id: string | null
          tabla_afectada: string
        }
        Insert: {
          accion: string
          id?: string
          ocurrido_en?: string
          persona_id?: string | null
          registro_id?: string | null
          tabla_afectada: string
        }
        Update: {
          accion?: string
          id?: string
          ocurrido_en?: string
          persona_id?: string | null
          registro_id?: string | null
          tabla_afectada?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_log_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueos: {
        Row: {
          abierto_en: string
          descripcion: string
          id: string
          persona_id: string
          proyecto_id: string
          resuelto_en: string | null
          resuelto_por: string | null
          tipo: Database["public"]["Enums"]["tipo_bloqueo"]
        }
        Insert: {
          abierto_en?: string
          descripcion: string
          id?: string
          persona_id: string
          proyecto_id: string
          resuelto_en?: string | null
          resuelto_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_bloqueo"]
        }
        Update: {
          abierto_en?: string
          descripcion?: string
          id?: string
          persona_id?: string
          proyecto_id?: string
          resuelto_en?: string | null
          resuelto_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_bloqueo"]
        }
        Relationships: [
          {
            foreignKeyName: "bloqueos_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueos_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      canales_venta: {
        Row: {
          id: string
          nombre: string
        }
        Insert: {
          id?: string
          nombre: string
        }
        Update: {
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      candidatos_alcance: {
        Row: {
          detectado_en: string
          estado: Database["public"]["Enums"]["estado_candidato"]
          fuente: string
          id: string
          nombre: string
          proyecto_id: string
          resuelto_en: string | null
          resuelto_por: string | null
        }
        Insert: {
          detectado_en?: string
          estado?: Database["public"]["Enums"]["estado_candidato"]
          fuente: string
          id?: string
          nombre: string
          proyecto_id: string
          resuelto_en?: string | null
          resuelto_por?: string | null
        }
        Update: {
          detectado_en?: string
          estado?: Database["public"]["Enums"]["estado_candidato"]
          fuente?: string
          id?: string
          nombre?: string
          proyecto_id?: string
          resuelto_en?: string | null
          resuelto_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidatos_alcance_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidatos_alcance_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          completado: boolean
          completado_en: string | null
          completado_por: string | null
          etapa: number
          id: string
          proyecto_id: string
          texto: string
        }
        Insert: {
          completado?: boolean
          completado_en?: string | null
          completado_por?: string | null
          etapa: number
          id?: string
          proyecto_id: string
          texto: string
        }
        Update: {
          completado?: boolean
          completado_en?: string | null
          completado_por?: string | null
          etapa?: number
          id?: string
          proyecto_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_completado_por_fkey"
            columns: ["completado_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          contacto: string | null
          creado_en: string
          id: string
          nombre: string
          notas: string | null
        }
        Insert: {
          contacto?: string | null
          creado_en?: string
          id?: string
          nombre: string
          notas?: string | null
        }
        Update: {
          contacto?: string | null
          creado_en?: string
          id?: string
          nombre?: string
          notas?: string | null
        }
        Relationships: []
      }
      commits: {
        Row: {
          archivos_tocados: string[]
          area_inferida: string | null
          fecha: string
          id: string
          mensaje: string | null
          persona_id: string | null
          repo_id: string
          sha: string
          tipo_inferido: string | null
        }
        Insert: {
          archivos_tocados?: string[]
          area_inferida?: string | null
          fecha: string
          id?: string
          mensaje?: string | null
          persona_id?: string | null
          repo_id: string
          sha: string
          tipo_inferido?: string | null
        }
        Update: {
          archivos_tocados?: string[]
          area_inferida?: string | null
          fecha?: string
          id?: string
          mensaje?: string | null
          persona_id?: string | null
          repo_id?: string
          sha?: string
          tipo_inferido?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commits_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commits_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositorios"
            referencedColumns: ["id"]
          },
        ]
      }
      componentes_proyecto: {
        Row: {
          id: string
          nombre: string
          orden: number
          peso_pct: number
          proyecto_id: string
        }
        Insert: {
          id?: string
          nombre: string
          orden?: number
          peso_pct?: number
          proyecto_id: string
        }
        Update: {
          id?: string
          nombre?: string
          orden?: number
          peso_pct?: number
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "componentes_proyecto_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_cases: {
        Row: {
          agent_type: string
          caso: string
          id: string
          resultado_esperado: string
          ultima_corrida: string | null
          ultimo_puntaje: number | null
        }
        Insert: {
          agent_type: string
          caso: string
          id?: string
          resultado_esperado: string
          ultima_corrida?: string | null
          ultimo_puntaje?: number | null
        }
        Update: {
          agent_type?: string
          caso?: string
          id?: string
          resultado_esperado?: string
          ultima_corrida?: string | null
          ultimo_puntaje?: number | null
        }
        Relationships: []
      }
      historial_etapas: {
        Row: {
          entra_en: string
          etapa: number
          id: string
          proyecto_id: string
          sale_en: string | null
        }
        Insert: {
          entra_en: string
          etapa: number
          id?: string
          proyecto_id: string
          sale_en?: string | null
        }
        Update: {
          entra_en?: string
          etapa?: number
          id?: string
          proyecto_id?: string
          sale_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historial_etapas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      hitos: {
        Row: {
          estado: Database["public"]["Enums"]["estado_hito"]
          etapa: number | null
          fecha_planeada: string | null
          fecha_real: string | null
          id: string
          nombre: string
          proyecto_id: string
        }
        Insert: {
          estado?: Database["public"]["Enums"]["estado_hito"]
          etapa?: number | null
          fecha_planeada?: string | null
          fecha_real?: string | null
          id?: string
          nombre: string
          proyecto_id: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["estado_hito"]
          etapa?: number | null
          fecha_planeada?: string | null
          fecha_real?: string | null
          id?: string
          nombre?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hitos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      implementaciones: {
        Row: {
          area: string | null
          commit_o_pr_vinculado: string | null
          creado_en: string
          descripcion: string
          id: string
          persona_id: string
          proyecto_id: string
        }
        Insert: {
          area?: string | null
          commit_o_pr_vinculado?: string | null
          creado_en?: string
          descripcion: string
          id?: string
          persona_id: string
          proyecto_id: string
        }
        Update: {
          area?: string | null
          commit_o_pr_vinculado?: string | null
          creado_en?: string
          descripcion?: string
          id?: string
          persona_id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementaciones_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementaciones_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      indicador_aplicabilidad: {
        Row: {
          aplica: boolean
          indicador_code: string
          modalidad: Database["public"]["Enums"]["modalidad_proyecto"]
          sustituye_comparacion: string | null
        }
        Insert: {
          aplica?: boolean
          indicador_code: string
          modalidad: Database["public"]["Enums"]["modalidad_proyecto"]
          sustituye_comparacion?: string | null
        }
        Update: {
          aplica?: boolean
          indicador_code?: string
          modalidad?: Database["public"]["Enums"]["modalidad_proyecto"]
          sustituye_comparacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicador_aplicabilidad_indicador_code_fkey"
            columns: ["indicador_code"]
            isOneToOne: false
            referencedRelation: "indicador_catalogo"
            referencedColumns: ["indicador_code"]
          },
        ]
      }
      indicador_catalogo: {
        Row: {
          categoria: string | null
          depende_de: Database["public"]["Enums"]["dependencia_indicador"]
          descripcion: string | null
          indicador_code: string
          nombre: string
          plazo: Database["public"]["Enums"]["plazo_indicador"] | null
        }
        Insert: {
          categoria?: string | null
          depende_de?: Database["public"]["Enums"]["dependencia_indicador"]
          descripcion?: string | null
          indicador_code: string
          nombre: string
          plazo?: Database["public"]["Enums"]["plazo_indicador"] | null
        }
        Update: {
          categoria?: string | null
          depende_de?: Database["public"]["Enums"]["dependencia_indicador"]
          descripcion?: string | null
          indicador_code?: string
          nombre?: string
          plazo?: Database["public"]["Enums"]["plazo_indicador"] | null
        }
        Relationships: []
      }
      indicador_madurez: {
        Row: {
          activado_en: string | null
          criterio_texto: string | null
          estado: Database["public"]["Enums"]["estado_madurez"]
          indicador_code: string
          meta: number | null
          valor_actual: number | null
        }
        Insert: {
          activado_en?: string | null
          criterio_texto?: string | null
          estado?: Database["public"]["Enums"]["estado_madurez"]
          indicador_code: string
          meta?: number | null
          valor_actual?: number | null
        }
        Update: {
          activado_en?: string | null
          criterio_texto?: string | null
          estado?: Database["public"]["Enums"]["estado_madurez"]
          indicador_code?: string
          meta?: number | null
          valor_actual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicador_madurez_indicador_code_fkey"
            columns: ["indicador_code"]
            isOneToOne: true
            referencedRelation: "indicador_catalogo"
            referencedColumns: ["indicador_code"]
          },
        ]
      }
      indicador_snapshots: {
        Row: {
          calculado_en: string
          detalle: Json | null
          id: string
          indicador_code: string
          periodo: string
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["ambito_indicador"]
          valor: number | null
        }
        Insert: {
          calculado_en?: string
          detalle?: Json | null
          id?: string
          indicador_code: string
          periodo: string
          scope_id?: string | null
          scope_type: Database["public"]["Enums"]["ambito_indicador"]
          valor?: number | null
        }
        Update: {
          calculado_en?: string
          detalle?: Json | null
          id?: string
          indicador_code?: string
          periodo?: string
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["ambito_indicador"]
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicador_snapshots_indicador_code_fkey"
            columns: ["indicador_code"]
            isOneToOne: false
            referencedRelation: "indicador_catalogo"
            referencedColumns: ["indicador_code"]
          },
        ]
      }
      leads: {
        Row: {
          atendido_por: string | null
          atendido_por_agente_id: string | null
          canal_id: string | null
          convertido: boolean
          fecha_conversion: string | null
          fecha_llegada: string
          id: string
          producto_id: string | null
        }
        Insert: {
          atendido_por?: string | null
          atendido_por_agente_id?: string | null
          canal_id?: string | null
          convertido?: boolean
          fecha_conversion?: string | null
          fecha_llegada?: string
          id?: string
          producto_id?: string | null
        }
        Update: {
          atendido_por?: string | null
          atendido_por_agente_id?: string | null
          canal_id?: string | null
          convertido?: boolean
          fecha_conversion?: string | null
          fecha_llegada?: string
          id?: string
          producto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_atendido_por_fkey"
            columns: ["atendido_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros_proyecto: {
        Row: {
          dedicacion_pct: number | null
          fecha_entrada: string
          fecha_salida: string | null
          id: string
          persona_id: string
          proyecto_id: string
          rol_proyecto_id: string | null
        }
        Insert: {
          dedicacion_pct?: number | null
          fecha_entrada?: string
          fecha_salida?: string | null
          id?: string
          persona_id: string
          proyecto_id: string
          rol_proyecto_id?: string | null
        }
        Update: {
          dedicacion_pct?: number | null
          fecha_entrada?: string
          fecha_salida?: string | null
          id?: string
          persona_id?: string
          proyecto_id?: string
          rol_proyecto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "miembros_proyecto_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miembros_proyecto_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "miembros_proyecto_rol_proyecto_id_fkey"
            columns: ["rol_proyecto_id"]
            isOneToOne: false
            referencedRelation: "roles_proyecto"
            referencedColumns: ["id"]
          },
        ]
      }
      oportunidades: {
        Row: {
          canal_venta_id: string | null
          cerrado_en: string | null
          cliente_id: string | null
          creado_en: string
          etapa_embudo: string | null
          id: string
          monto: number | null
          probabilidad: number | null
          proyecto_id: string | null
          resultado: Database["public"]["Enums"]["resultado_oportunidad"]
        }
        Insert: {
          canal_venta_id?: string | null
          cerrado_en?: string | null
          cliente_id?: string | null
          creado_en?: string
          etapa_embudo?: string | null
          id?: string
          monto?: number | null
          probabilidad?: number | null
          proyecto_id?: string | null
          resultado?: Database["public"]["Enums"]["resultado_oportunidad"]
        }
        Update: {
          canal_venta_id?: string | null
          cerrado_en?: string | null
          cliente_id?: string | null
          creado_en?: string
          etapa_embudo?: string | null
          id?: string
          monto?: number | null
          probabilidad?: number | null
          proyecto_id?: string | null
          resultado?: Database["public"]["Enums"]["resultado_oportunidad"]
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_canal_venta_id_fkey"
            columns: ["canal_venta_id"]
            isOneToOne: false
            referencedRelation: "canales_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          activo: boolean
          auth_user_id: string | null
          creado_en: string
          email: string
          fecha_ingreso: string
          github_username: string | null
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_global"]
        }
        Insert: {
          activo?: boolean
          auth_user_id?: string | null
          creado_en?: string
          email: string
          fecha_ingreso?: string
          github_username?: string | null
          id?: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol_global"]
        }
        Update: {
          activo?: boolean
          auth_user_id?: string | null
          creado_en?: string
          email?: string
          fecha_ingreso?: string
          github_username?: string | null
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_global"]
        }
        Relationships: []
      }
      productos: {
        Row: {
          descripcion: string | null
          id: string
          nombre: string
          proyecto_origen_id: string | null
          tipo: string | null
        }
        Insert: {
          descripcion?: string | null
          id?: string
          nombre: string
          proyecto_origen_id?: string | null
          tipo?: string | null
        }
        Update: {
          descripcion?: string | null
          id?: string
          nombre?: string
          proyecto_origen_id?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_proyecto_origen_id_fkey"
            columns: ["proyecto_origen_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          alcance_congelado_en: string | null
          cliente_id: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          encargado_id: string | null
          estado: Database["public"]["Enums"]["estado_proyecto"]
          etapa_actual: number
          fecha_inicio: string | null
          fecha_limite: string | null
          fecha_objetivo: string | null
          horas_estimadas: number | null
          id: string
          modalidad: Database["public"]["Enums"]["modalidad_proyecto"]
          nombre: string
          prioridad: number | null
          tipo: string | null
        }
        Insert: {
          alcance_congelado_en?: string | null
          cliente_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          encargado_id?: string | null
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          etapa_actual?: number
          fecha_inicio?: string | null
          fecha_limite?: string | null
          fecha_objetivo?: string | null
          horas_estimadas?: number | null
          id?: string
          modalidad?: Database["public"]["Enums"]["modalidad_proyecto"]
          nombre: string
          prioridad?: number | null
          tipo?: string | null
        }
        Update: {
          alcance_congelado_en?: string | null
          cliente_id?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          encargado_id?: string | null
          estado?: Database["public"]["Enums"]["estado_proyecto"]
          etapa_actual?: number
          fecha_inicio?: string | null
          fecha_limite?: string | null
          fecha_objetivo?: string | null
          horas_estimadas?: number | null
          id?: string
          modalidad?: Database["public"]["Enums"]["modalidad_proyecto"]
          nombre?: string
          prioridad?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_encargado_id_fkey"
            columns: ["encargado_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      pull_requests: {
        Row: {
          abierto_en: string | null
          archivos_tocados: string[]
          area_inferida: string | null
          id: string
          mergeado_en: string | null
          numero: number
          persona_id: string | null
          repo_id: string
          titulo: string | null
        }
        Insert: {
          abierto_en?: string | null
          archivos_tocados?: string[]
          area_inferida?: string | null
          id?: string
          mergeado_en?: string | null
          numero: number
          persona_id?: string | null
          repo_id: string
          titulo?: string | null
        }
        Update: {
          abierto_en?: string | null
          archivos_tocados?: string[]
          area_inferida?: string | null
          id?: string
          mergeado_en?: string | null
          numero?: number
          persona_id?: string | null
          repo_id?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pull_requests_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pull_requests_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositorios"
            referencedColumns: ["id"]
          },
        ]
      }
      puntos_componente: {
        Row: {
          componente_id: string
          id: string
          nombre: string
          origen: Database["public"]["Enums"]["origen_punto"]
          responsable_id: string | null
          rutas_esperadas: string[]
          verificado: boolean
          verificado_en: string | null
        }
        Insert: {
          componente_id: string
          id?: string
          nombre: string
          origen?: Database["public"]["Enums"]["origen_punto"]
          responsable_id?: string | null
          rutas_esperadas?: string[]
          verificado?: boolean
          verificado_en?: string | null
        }
        Update: {
          componente_id?: string
          id?: string
          nombre?: string
          origen?: Database["public"]["Enums"]["origen_punto"]
          responsable_id?: string | null
          rutas_esperadas?: string[]
          verificado?: boolean
          verificado_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "puntos_componente_componente_id_fkey"
            columns: ["componente_id"]
            isOneToOne: false
            referencedRelation: "componentes_proyecto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_componente_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      registro_tiempo: {
        Row: {
          area: string | null
          creado_en: string
          fecha: string
          horas: number
          id: string
          origen: Database["public"]["Enums"]["origen_tiempo"]
          persona_id: string
          proyecto_id: string
          tipo: Database["public"]["Enums"]["tipo_tiempo"]
        }
        Insert: {
          area?: string | null
          creado_en?: string
          fecha: string
          horas: number
          id?: string
          origen?: Database["public"]["Enums"]["origen_tiempo"]
          persona_id: string
          proyecto_id: string
          tipo?: Database["public"]["Enums"]["tipo_tiempo"]
        }
        Update: {
          area?: string | null
          creado_en?: string
          fecha?: string
          horas?: number
          id?: string
          origen?: Database["public"]["Enums"]["origen_tiempo"]
          persona_id?: string
          proyecto_id?: string
          tipo?: Database["public"]["Enums"]["tipo_tiempo"]
        }
        Relationships: [
          {
            foreignKeyName: "registro_tiempo_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_tiempo_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      repositorios: {
        Row: {
          creado_en: string
          github_installation_id: number | null
          github_repo: string
          id: string
          proyecto_id: string
        }
        Insert: {
          creado_en?: string
          github_installation_id?: number | null
          github_repo: string
          id?: string
          proyecto_id: string
        }
        Update: {
          creado_en?: string
          github_installation_id?: number | null
          github_repo?: string
          id?: string
          proyecto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repositorios_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      roles_proyecto: {
        Row: {
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      sesiones_claude_code: {
        Row: {
          archivos_tocados: string[]
          area_inferida: string | null
          duracion_activa: string | null
          fin: string | null
          id: string
          inicio: string
          persona_id: string | null
          prompt_count: number
          proyecto_id: string | null
          session_id: string
        }
        Insert: {
          archivos_tocados?: string[]
          area_inferida?: string | null
          duracion_activa?: string | null
          fin?: string | null
          id?: string
          inicio: string
          persona_id?: string | null
          prompt_count?: number
          proyecto_id?: string | null
          session_id: string
        }
        Update: {
          archivos_tocados?: string[]
          area_inferida?: string | null
          duracion_activa?: string | null
          fin?: string | null
          id?: string
          inicio?: string
          persona_id?: string | null
          prompt_count?: number
          proyecto_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_claude_code_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesiones_claude_code_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarea_evidencia: {
        Row: {
          area: string
          detectado_en: string
          fuente: Database["public"]["Enums"]["fuente_evidencia"]
          id: string
          referencia: string
          tarea_id: string
        }
        Insert: {
          area: string
          detectado_en?: string
          fuente: Database["public"]["Enums"]["fuente_evidencia"]
          id?: string
          referencia: string
          tarea_id: string
        }
        Update: {
          area?: string
          detectado_en?: string
          fuente?: Database["public"]["Enums"]["fuente_evidencia"]
          id?: string
          referencia?: string
          tarea_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarea_evidencia_tarea_id_fkey"
            columns: ["tarea_id"]
            isOneToOne: false
            referencedRelation: "tareas_semanales"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas_semanales: {
        Row: {
          areas: string[]
          creado_en: string
          creado_por: string | null
          id: string
          persona_id: string
          proyecto_id: string
          semana_fin: string
          semana_inicio: string
          titulo: string
        }
        Insert: {
          areas?: string[]
          creado_en?: string
          creado_por?: string | null
          id?: string
          persona_id: string
          proyecto_id: string
          semana_fin: string
          semana_inicio: string
          titulo: string
        }
        Update: {
          areas?: string[]
          creado_en?: string
          creado_por?: string | null
          id?: string
          persona_id?: string
          proyecto_id?: string
          semana_fin?: string
          semana_inicio?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_semanales_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_semanales_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_semanales_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      trazas_agente: {
        Row: {
          agent_id: string | null
          agent_type: string | null
          args_hash: string | null
          duration_ms: number | null
          environment: string | null
          id: string
          iteration_index: number | null
          node_name: string | null
          proyecto_id: string | null
          registrado_en: string
          run_id: string
          status: string | null
          tokens: number | null
          tool_name: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_type?: string | null
          args_hash?: string | null
          duration_ms?: number | null
          environment?: string | null
          id?: string
          iteration_index?: number | null
          node_name?: string | null
          proyecto_id?: string | null
          registrado_en?: string
          run_id: string
          status?: string | null
          tokens?: number | null
          tool_name?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_type?: string | null
          args_hash?: string | null
          duration_ms?: number | null
          environment?: string | null
          id?: string
          iteration_index?: number | null
          node_name?: string | null
          proyecto_id?: string | null
          registrado_en?: string
          run_id?: string
          status?: string | null
          tokens?: number | null
          tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trazas_agente_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          atendido_por_agente_id: string | null
          canal_id: string | null
          cliente_id: string | null
          fecha: string
          id: string
          lead_id: string | null
          monto: number
          producto_id: string | null
          vendido_por: string | null
        }
        Insert: {
          atendido_por_agente_id?: string | null
          canal_id?: string | null
          cliente_id?: string | null
          fecha: string
          id?: string
          lead_id?: string | null
          monto: number
          producto_id?: string | null
          vendido_por?: string | null
        }
        Update: {
          atendido_por_agente_id?: string | null
          canal_id?: string | null
          cliente_id?: string | null
          fecha?: string
          id?: string
          lead_id?: string | null
          monto?: number
          producto_id?: string | null
          vendido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canales_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_vendido_por_fkey"
            columns: ["vendido_por"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cambiar_etapa_proyecto: {
        Args: { p_etapa: number; p_proyecto_id: string }
        Returns: {
          alcance_congelado_en: string | null
          cliente_id: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          encargado_id: string | null
          estado: Database["public"]["Enums"]["estado_proyecto"]
          etapa_actual: number
          fecha_inicio: string | null
          fecha_limite: string | null
          fecha_objetivo: string | null
          horas_estimadas: number | null
          id: string
          modalidad: Database["public"]["Enums"]["modalidad_proyecto"]
          nombre: string
          prioridad: number | null
          tipo: string | null
        }
        SetofOptions: {
          from: "*"
          to: "proyectos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      crear_proyecto: {
        Args: {
          p_cliente_id?: string
          p_descripcion?: string
          p_encargado_id?: string
          p_etapa_inicial?: number
          p_fecha_inicio?: string
          p_fecha_limite?: string
          p_fecha_objetivo?: string
          p_horas_estimadas?: number
          p_modalidad?: Database["public"]["Enums"]["modalidad_proyecto"]
          p_nombre: string
          p_prioridad?: number
          p_tipo?: string
        }
        Returns: {
          alcance_congelado_en: string | null
          cliente_id: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          encargado_id: string | null
          estado: Database["public"]["Enums"]["estado_proyecto"]
          etapa_actual: number
          fecha_inicio: string | null
          fecha_limite: string | null
          fecha_objetivo: string | null
          horas_estimadas: number | null
          id: string
          modalidad: Database["public"]["Enums"]["modalidad_proyecto"]
          nombre: string
          prioridad: number | null
          tipo: string | null
        }
        SetofOptions: {
          from: "*"
          to: "proyectos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      ambito_indicador: "persona" | "proyecto" | "portafolio"
      dependencia_indicador: "persona" | "cliente" | "mixto"
      estado_candidato: "pendiente" | "aprobado" | "descartado" | "archivado"
      estado_hito: "pendiente" | "en_curso" | "cumplido" | "vencido"
      estado_madurez: "maduracion" | "activo"
      estado_proyecto: "activo" | "pausado" | "archivado"
      fuente_evidencia: "commit" | "pull_request" | "sesion_claude_code"
      modalidad_proyecto: "individual" | "equipo"
      origen_punto: "manual" | "sugerido_por_agente" | "claude_md"
      origen_tiempo: "manual" | "inferido"
      plazo_indicador: "inmediato" | "mediano" | "largo"
      resultado_oportunidad: "ganada" | "perdida" | "abierta"
      rol_global: "admin" | "lider_proyecto" | "colaborador"
      tipo_bloqueo: "interno" | "externo" | "cliente"
      tipo_tiempo: "facturable" | "interno"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ambito_indicador: ["persona", "proyecto", "portafolio"],
      dependencia_indicador: ["persona", "cliente", "mixto"],
      estado_candidato: ["pendiente", "aprobado", "descartado", "archivado"],
      estado_hito: ["pendiente", "en_curso", "cumplido", "vencido"],
      estado_madurez: ["maduracion", "activo"],
      estado_proyecto: ["activo", "pausado", "archivado"],
      fuente_evidencia: ["commit", "pull_request", "sesion_claude_code"],
      modalidad_proyecto: ["individual", "equipo"],
      origen_punto: ["manual", "sugerido_por_agente", "claude_md"],
      origen_tiempo: ["manual", "inferido"],
      plazo_indicador: ["inmediato", "mediano", "largo"],
      resultado_oportunidad: ["ganada", "perdida", "abierta"],
      rol_global: ["admin", "lider_proyecto", "colaborador"],
      tipo_bloqueo: ["interno", "externo", "cliente"],
      tipo_tiempo: ["facturable", "interno"],
    },
  },
} as const
