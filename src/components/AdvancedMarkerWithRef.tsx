import {
  AdvancedMarker,
  useAdvancedMarkerRef,
  type AdvancedMarkerProps,
} from '@vis.gl/react-google-maps';

type AdvancedMarkerInstance = google.maps.marker.AdvancedMarkerElement;

interface AdvancedMarkerWithRefProps extends AdvancedMarkerProps {
  onMarkerClick: (marker: AdvancedMarkerInstance) => void;
}

export function AdvancedMarkerWithRef({
  children,
  onMarkerClick,
  ...advancedMarkerProps
}: AdvancedMarkerWithRefProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      onClick={() => {
        if (marker) {
          onMarkerClick(marker);
        }
      }}
      {...advancedMarkerProps}
    >
      {children}
    </AdvancedMarker>
  );
}
