import { requireNativeComponent, type ViewProps } from "react-native";
interface Props extends ViewProps {
  uri: string;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  onError: () => void;
  onLoad: () => void;
}
export const PairedViewer = requireNativeComponent<Props>("PairedBridgeViewer");
