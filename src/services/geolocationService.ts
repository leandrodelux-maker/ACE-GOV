export type GpsAccuracyLevel = 'excelente' | 'aceitavel' | 'impreciso';

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number; // em metros
  capturedAt: string;
}

export interface GeolocationAssessment {
  coordinate: GeoCoordinate;
  accuracyLevel: GpsAccuracyLevel;
  accuracyColor: string;
  accuracyLabel: string;
  isAcceptable: boolean;
  requiresWarning: boolean;
  requiresJustification: boolean;
  inconsistencyMessage?: string;
}

export const GEOLOCATION_CONFIG = {
  EXCELLENT_MAX_METERS: 15,
  ACCEPTABLE_MAX_METERS: 50,
  MUNICIPALITY_MAX_RADIUS_KM: 60, // Limite plausível para alerta de coordenada fora do município
};

export const geolocationService = {
  /**
   * Avalia a precisão de uma leitura de GPS conforme os padrões operacionais do Endemias GOV
   */
  assessAccuracy(coordinate: GeoCoordinate): GeolocationAssessment {
    const { accuracy } = coordinate;

    if (accuracy <= GEOLOCATION_CONFIG.EXCELLENT_MAX_METERS) {
      return {
        coordinate,
        accuracyLevel: 'excelente',
        accuracyColor: 'emerald',
        accuracyLabel: `Excelente (±${Math.round(accuracy)}m)`,
        isAcceptable: true,
        requiresWarning: false,
        requiresJustification: false
      };
    }

    if (accuracy <= GEOLOCATION_CONFIG.ACCEPTABLE_MAX_METERS) {
      return {
        coordinate,
        accuracyLevel: 'aceitavel',
        accuracyColor: 'amber',
        accuracyLabel: `Aceitável (±${Math.round(accuracy)}m)`,
        isAcceptable: true,
        requiresWarning: true,
        requiresJustification: false
      };
    }

    return {
      coordinate,
      accuracyLevel: 'impreciso',
      accuracyColor: 'rose',
      accuracyLabel: `Baixa Precisão (±${Math.round(accuracy)}m)`,
      isAcceptable: false,
      requiresWarning: true,
      requiresJustification: true,
      inconsistencyMessage: 'Sinal de GPS fraco ou obstruído. Recomenda-se ir a uma área aberta ou justificar.'
    };
  },

  /**
   * Captura a posição atual do dispositivo usando a API nativa de Geolocation com alta precisão
   */
  async getCurrentPosition(timeoutMs = 15000): Promise<GeolocationAssessment> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não é suportada neste navegador ou dispositivo.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coord: GeoCoordinate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 30,
            capturedAt: new Date(position.timestamp).toISOString()
          };
          resolve(this.assessAccuracy(coord));
        },
        (error) => {
          let msg = 'Erro ao capturar localização.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              msg = 'Permissão de localização negada pelo usuário.';
              break;
            case error.POSITION_UNAVAILABLE:
              msg = 'Sinal de GPS indisponível no momento.';
              break;
            case error.TIMEOUT:
              msg = 'Tempo limite excedido na busca do sinal de GPS.';
              break;
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0
        }
      );
    });
  },

  /**
   * Calcula distância geodésica simples em metros entre dois pontos (Haversine)
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  },

  /**
   * Valida se uma coordenada coletada está próxima da coordenada cadastrada do imóvel
   */
  validatePropertyProximity(
    coord: GeoCoordinate,
    propertyLat?: number,
    propertyLon?: number,
    thresholdMeters = 150
  ): { isNearby: boolean; distanceMeters?: number; warning?: string } {
    if (!propertyLat || !propertyLon) {
      return { isNearby: true };
    }

    const dist = this.calculateDistance(coord.latitude, coord.longitude, propertyLat, propertyLon);

    if (dist > thresholdMeters) {
      return {
        isNearby: false,
        distanceMeters: dist,
        warning: `A coordenada capturada está a ${dist} metros da localização cadastrada do imóvel.`
      };
    }

    return { isNearby: true, distanceMeters: dist };
  }
};
