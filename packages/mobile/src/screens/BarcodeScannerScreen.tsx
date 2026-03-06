import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useStore } from "../contexts/StoreContext";
import { api } from "../utils/api";
import { colors, fontSize, spacing } from "../utils/theme";

interface ScannedItem {
  barcode: string;
  itemName: string;
  supplierName: string;
  unit: string;
  expectedPrice: number;
  quantity: number;
  orderId?: string;
}

export function BarcodeScannerScreen() {
  const { selectedStoreId } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (data === lastScanned || loading) return;
    setLastScanned(data);
    setLoading(true);

    try {
      const result = await api.lookupBarcode(data, selectedStoreId || undefined);

      const newItem: ScannedItem = {
        barcode: data,
        itemName: result.ingredient.itemName,
        supplierName: result.supplier.name,
        unit: result.ingredient.unit,
        expectedPrice: result.expectedPrice,
        quantity: result.casePack || 1,
        orderId: result.openPurchaseOrders?.[0]?.orderId,
      };

      setScannedItems((prev) => [...prev, newItem]);
      setScanning(false);
    } catch (err: any) {
      Alert.alert("Not Found", err.message || "Barcode not recognized");
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (index: number, qty: string) => {
    const num = parseInt(qty, 10);
    if (isNaN(num)) return;
    setScannedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: num } : item))
    );
  };

  const removeItem = (index: number) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submitReceiving = async () => {
    if (!selectedStoreId || scannedItems.length === 0) return;
    setSubmitting(true);

    try {
      const scans = scannedItems.map((item) => ({
        barcode: item.barcode,
        quantity: item.quantity,
      }));

      const orderId = scannedItems.find((i) => i.orderId)?.orderId;

      const result = await api.receiveShipment(selectedStoreId, {
        orderId,
        scans,
      });

      const discCount = result.discrepancies?.length || 0;
      Alert.alert(
        "Shipment Received",
        `${result.totalItemsReceived} items received.${discCount > 0 ? ` ${discCount} discrepancies found.` : ""}`,
        [{ text: "OK" }]
      );
      setScannedItems([]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>Camera permission is required to scan barcodes.</Text>
        <TouchableOpacity style={styles.viewListBtn} onPress={requestPermission}>
          <Text style={styles.viewListText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {scanning ? (
        <View style={styles.scannerContainer}>
          <CameraView
            onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
            }}
          />
          <View style={styles.overlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanText}>
              {loading ? "Looking up barcode..." : "Point at a barcode to scan"}
            </Text>
          </View>
          {scannedItems.length > 0 && (
            <TouchableOpacity
              style={styles.viewListBtn}
              onPress={() => setScanning(false)}
            >
              <Text style={styles.viewListText}>
                View Scanned ({scannedItems.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              Scanned Items ({scannedItems.length})
            </Text>
            <TouchableOpacity
              style={styles.scanMoreBtn}
              onPress={() => {
                setScanning(true);
                setLastScanned(null);
              }}
            >
              <Text style={styles.scanMoreText}>+ Scan More</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={scannedItems}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <View style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.itemName}</Text>
                    <Text style={styles.itemDetail}>
                      {item.supplierName} | ${item.expectedPrice}/{item.unit}
                    </Text>
                    {item.orderId && (
                      <Text style={styles.poTag}>On PO</Text>
                    )}
                  </View>
                  <View style={styles.qtyContainer}>
                    <TextInput
                      style={styles.qtyInput}
                      value={item.quantity.toString()}
                      onChangeText={(val) => updateQuantity(index, val)}
                      keyboardType="numeric"
                    />
                    <Text style={styles.unitLabel}>{item.unit}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeItem(index)}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={submitReceiving}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                Confirm Receiving ({scannedItems.length} items)
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  permText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md },
  scannerContainer: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 12,
  },
  scanText: {
    color: "#fff",
    fontSize: fontSize.md,
    marginTop: spacing.md,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  viewListBtn: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 25,
  },
  viewListText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },
  listContainer: { flex: 1, paddingTop: spacing.md },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  listTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  scanMoreBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  scanMoreText: { color: "#fff", fontWeight: "600", fontSize: fontSize.sm },
  itemCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 10,
    padding: spacing.md,
  },
  itemRow: { flexDirection: "row", alignItems: "center" },
  itemInfo: { flex: 1 },
  itemName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  itemDetail: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  poTag: {
    fontSize: fontSize.xs,
    color: colors.secondary,
    fontWeight: "600",
    marginTop: 2,
  },
  qtyContainer: { alignItems: "center", marginRight: spacing.sm },
  qtyInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    width: 60,
    textAlign: "center",
    padding: spacing.sm,
    fontSize: fontSize.md,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  removeBtn: { padding: spacing.sm },
  removeText: { fontSize: fontSize.lg, color: colors.danger },
  submitBtn: {
    backgroundColor: colors.secondary,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
});
