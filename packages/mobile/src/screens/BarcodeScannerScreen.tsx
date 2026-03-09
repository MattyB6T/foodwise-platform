import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
  ScrollView,
  Image,
} from "react-native";
import { CameraView, useCameraPermissions, Camera } from "expo-camera";
import { useStore } from "../contexts/StoreContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../utils/api";
import { fontSize, spacing, type ColorScheme } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

type ScanMode = "barcode" | "invoice";

interface ScannedItem {
  barcode: string;
  itemName: string;
  supplierName: string;
  unit: string;
  expectedPrice: number;
  quantity: number;
  orderId?: string;
}

interface InvoiceLineItem {
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  matchedItemId: string | null;
  matchedItemName: string | null;
  matchConfidence: number;
}

interface InvoiceScanResult {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export function BarcodeScannerScreen() {
  const { selectedStoreId } = useStore();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [webPermission, setWebPermission] = useState<boolean | null>(null);
  const [mode, setMode] = useState<ScanMode>("barcode");
  const [scanning, setScanning] = useState(true);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");

  // Invoice mode state
  const [invoiceResult, setInvoiceResult] = useState<InvoiceScanResult | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const [invoiceProcessing, setInvoiceProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const s = makeStyles(colors);

  // On web, skip camera entirely — go straight to manual entry / file upload
  // Camera requires HTTPS which isn't available in local dev (http://)
  const isWeb = Platform.OS === "web";
  const isGranted = isWeb ? true : permission?.granted;
  const isLoading = isWeb ? false : !permission;
  const wasDenied = !isWeb && permission && !permission.granted && !permission.canAskAgain;

  const handleNativePermission = async () => {
    if (wasDenied) {
      Linking.openSettings();
    } else {
      // Use Camera static method as fallback — more reliable than hook's requestPermission
      try {
        const result = await Camera.requestCameraPermissionsAsync();
        if (!result.granted) {
          Alert.alert(
            "Permission Required",
            "Camera access is needed to scan barcodes and invoices. Please enable it in Settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
        }
      } catch {
        await requestPermission();
      }
    }
  };

  // --- Barcode handlers ---
  const handleManualLookup = () => {
    if (manualBarcode.trim()) {
      handleBarCodeScanned({ data: manualBarcode.trim() });
      setManualBarcode("");
    }
  };

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

  // --- Invoice handlers ---
  const handleTakeInvoicePhoto = async () => {
    if (!cameraRef.current || invoiceProcessing) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (!photo?.base64) {
        Alert.alert("Error", "Failed to capture photo. Please try again.");
        return;
      }

      setInvoicePreview(photo.uri);
      setInvoiceProcessing(true);

      const result = await api.scanInvoice(selectedStoreId!, photo.base64);
      setInvoiceResult(result);
    } catch (err: any) {
      Alert.alert("Scan Failed", err.message || "Could not read the invoice. Try a clearer photo.");
      setInvoicePreview(null);
    } finally {
      setInvoiceProcessing(false);
    }
  };

  const acceptInvoiceItems = () => {
    if (!invoiceResult) return;

    const newItems: ScannedItem[] = invoiceResult.lineItems.map((line) => ({
      barcode: "",
      itemName: line.matchedItemName || line.itemName,
      supplierName: invoiceResult.supplierName,
      unit: line.unit,
      expectedPrice: line.unitPrice,
      quantity: line.quantity,
    }));

    setScannedItems((prev) => [...prev, ...newItems]);
    setInvoiceResult(null);
    setInvoicePreview(null);
    setScanning(false);
  };

  const retakeInvoice = () => {
    setInvoiceResult(null);
    setInvoicePreview(null);
  };

  // --- Shared handlers ---
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
      const result = await api.receiveShipment(selectedStoreId, { orderId, scans });
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

  // --- Renders ---
  if (!selectedStoreId) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" }}>
          Select a store from the Dashboard first
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[s.permText, { color: colors.textSecondary }]}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!isGranted) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={[s.permText, { color: colors.textSecondary }]}>
          {wasDenied
            ? "Camera permission was denied. Please enable it in your device settings."
            : "Camera permission is required to scan barcodes and invoices."}
        </Text>
        <TouchableOpacity
          style={[s.viewListBtn, { backgroundColor: colors.primary, position: "relative", bottom: "auto", marginTop: spacing.lg }]}
          onPress={handleNativePermission}
        >
          <Text style={s.viewListText}>{wasDenied ? "Open Settings" : "Grant Permission"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Mode toggle bar
  const ModeToggle = () => (
    <View style={[s.modeToggle, { backgroundColor: colors.surface }]}>
      <TouchableOpacity
        style={[s.modeBtn, mode === "barcode" && { backgroundColor: colors.primary }]}
        onPress={() => { setMode("barcode"); setInvoiceResult(null); setInvoicePreview(null); }}
      >
        <Text style={[s.modeBtnText, mode === "barcode" && { color: "#fff" }]}>
          Barcode
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.modeBtn, mode === "invoice" && { backgroundColor: colors.primary }]}
        onPress={() => setMode("invoice")}
      >
        <Text style={[s.modeBtnText, mode === "invoice" && { color: "#fff" }]}>
          Invoice
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Invoice results review screen
  if (invoiceResult) {
    const highConfidence = invoiceResult.lineItems.filter((l) => l.matchConfidence >= 0.7);
    const lowConfidence = invoiceResult.lineItems.filter((l) => l.matchConfidence < 0.7);

    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <StorePicker />
        <ModeToggle />
        <ScrollView style={s.listContainer}>
          {/* Invoice header */}
          <View style={[s.invoiceHeader, { backgroundColor: colors.surface }]}>
            {invoiceResult.supplierName ? (
              <Text style={[s.listTitle, { color: colors.text }]}>{invoiceResult.supplierName}</Text>
            ) : null}
            <View style={s.invoiceMetaRow}>
              {invoiceResult.invoiceNumber ? (
                <Text style={[s.itemDetail, { color: colors.textSecondary }]}>
                  #{invoiceResult.invoiceNumber}
                </Text>
              ) : null}
              {invoiceResult.invoiceDate ? (
                <Text style={[s.itemDetail, { color: colors.textSecondary }]}>
                  {invoiceResult.invoiceDate}
                </Text>
              ) : null}
            </View>
            <Text style={[s.invoiceTotal, { color: colors.text }]}>
              {invoiceResult.lineItems.length} items  |  ${invoiceResult.total.toFixed(2)}
            </Text>
          </View>

          {/* Matched items */}
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>
            {highConfidence.length} MATCHED
          </Text>
          {highConfidence.map((line, i) => (
            <View key={`m-${i}`} style={[s.itemCard, { backgroundColor: colors.surface }]}>
              <View style={s.itemRow}>
                <View style={s.itemInfo}>
                  <Text style={[s.itemName, { color: colors.text }]}>
                    {line.matchedItemName || line.itemName}
                  </Text>
                  <Text style={[s.itemDetail, { color: colors.textSecondary }]}>
                    Invoice: {line.itemName}  |  ${line.unitPrice.toFixed(2)}/{line.unit}
                  </Text>
                  <Text style={[s.matchBadge, { color: colors.secondary }]}>
                    {Math.round(line.matchConfidence * 100)}% match
                  </Text>
                </View>
                <View style={s.qtyContainer}>
                  <Text style={[s.qtyDisplay, { color: colors.text }]}>{line.quantity}</Text>
                  <Text style={[s.unitLabel, { color: colors.textSecondary }]}>{line.unit}</Text>
                </View>
              </View>
            </View>
          ))}

          {/* Unmatched items */}
          {lowConfidence.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: colors.warning || "#f59e0b" }]}>
                {lowConfidence.length} UNMATCHED
              </Text>
              {lowConfidence.map((line, i) => (
                <View key={`u-${i}`} style={[s.itemCard, { backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.warning || "#f59e0b" }]}>
                  <View style={s.itemRow}>
                    <View style={s.itemInfo}>
                      <Text style={[s.itemName, { color: colors.text }]}>{line.itemName}</Text>
                      <Text style={[s.itemDetail, { color: colors.textSecondary }]}>
                        ${line.unitPrice.toFixed(2)}/{line.unit}  |  Not in inventory
                      </Text>
                    </View>
                    <View style={s.qtyContainer}>
                      <Text style={[s.qtyDisplay, { color: colors.text }]}>{line.quantity}</Text>
                      <Text style={[s.unitLabel, { color: colors.textSecondary }]}>{line.unit}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* Action buttons */}
        <View style={s.invoiceActions}>
          <TouchableOpacity
            style={[s.scanMoreBtn, { backgroundColor: colors.surface, flex: 1, alignItems: "center", marginRight: spacing.sm }]}
            onPress={retakeInvoice}
          >
            <Text style={[s.scanMoreText, { color: colors.text }]}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: colors.secondary, flex: 2, margin: 0 }]}
            onPress={acceptInvoiceItems}
          >
            <Text style={s.submitText}>
              Accept {invoiceResult.lineItems.length} Items
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Scanned items list view (shared between modes)
  if (!scanning && scannedItems.length > 0) {
    return (
      <View style={[s.container, { backgroundColor: colors.background }]}>
        <StorePicker />
        <ModeToggle />
        <View style={s.listContainer}>
          <View style={s.listHeader}>
            <Text style={[s.listTitle, { color: colors.text }]}>Scanned Items ({scannedItems.length})</Text>
            <TouchableOpacity
              style={[s.scanMoreBtn, { backgroundColor: colors.primaryLight }]}
              onPress={() => { setScanning(true); setLastScanned(null); }}
            >
              <Text style={s.scanMoreText}>+ Scan More</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={scannedItems}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <View style={[s.itemCard, { backgroundColor: colors.surface }]}>
                <View style={s.itemRow}>
                  <View style={s.itemInfo}>
                    <Text style={[s.itemName, { color: colors.text }]}>{item.itemName}</Text>
                    <Text style={[s.itemDetail, { color: colors.textSecondary }]}>
                      {item.supplierName} | ${item.expectedPrice}/{item.unit}
                    </Text>
                    {item.orderId && (
                      <Text style={[s.poTag, { color: colors.secondary }]}>On PO</Text>
                    )}
                  </View>
                  <View style={s.qtyContainer}>
                    <TextInput
                      style={[s.qtyInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={item.quantity.toString()}
                      onChangeText={(val) => updateQuantity(index, val)}
                      keyboardType="numeric"
                    />
                    <Text style={[s.unitLabel, { color: colors.textSecondary }]}>{item.unit}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(index)} style={s.removeBtn}>
                    <Text style={[s.removeText, { color: colors.danger }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: colors.secondary }, submitting && s.submitDisabled]}
            onPress={submitReceiving}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitText}>Confirm Receiving ({scannedItems.length} items)</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Camera / scanning views
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <StorePicker />
      <ModeToggle />

      {mode === "barcode" ? (
        // --- Barcode scanning ---
        <View style={s.scannerContainer}>
          {Platform.OS === "web" ? (
            <View style={[s.centered, { flex: 1 }]}>
              <Text style={[s.listTitle, { color: colors.text, marginBottom: spacing.sm }]}>Enter Barcode</Text>
              <Text style={[s.permText, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
                Camera scanning is not supported in web browsers.{"\n"}Enter the barcode number manually.
              </Text>
              <TextInput
                style={[s.qtyInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, width: 250, marginBottom: spacing.md }]}
                placeholder="Barcode number..."
                placeholderTextColor={colors.textSecondary}
                value={manualBarcode}
                onChangeText={setManualBarcode}
                onSubmitEditing={handleManualLookup}
                autoFocus
              />
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: colors.primary, margin: 0 }]}
                onPress={handleManualLookup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitText}>Look Up</Text>
                )}
              </TouchableOpacity>
              {scannedItems.length > 0 && (
                <TouchableOpacity
                  style={[s.scanMoreBtn, { backgroundColor: colors.primaryLight, marginTop: spacing.lg }]}
                  onPress={() => setScanning(false)}
                >
                  <Text style={s.scanMoreText}>View Scanned ({scannedItems.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <CameraView
                onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{
                  barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
                }}
              />
              <View style={s.overlay}>
                <View style={s.scanFrame} />
                <Text style={s.scanText}>
                  {loading ? "Looking up barcode..." : "Point at a barcode to scan"}
                </Text>
              </View>
              {scannedItems.length > 0 && (
                <TouchableOpacity
                  style={[s.viewListBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setScanning(false)}
                >
                  <Text style={s.viewListText}>View Scanned ({scannedItems.length})</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      ) : (
        // --- Invoice scanning ---
        <View style={s.scannerContainer}>
          {isWeb ? (
            <View style={[s.centered, { flex: 1 }]}>
              <Text style={[s.listTitle, { color: colors.text, marginBottom: spacing.sm }]}>Scan Invoice</Text>
              <Text style={[s.permText, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
                Take a photo or upload an image of your invoice.
              </Text>
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: colors.primary, margin: 0, paddingHorizontal: spacing.xl || 32 }]}
                onPress={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.capture = "environment";
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file || !selectedStoreId) return;
                    setInvoiceProcessing(true);
                    try {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64 = (reader.result as string).split(",")[1];
                        setInvoicePreview(reader.result as string);
                        try {
                          const result = await api.scanInvoice(selectedStoreId, base64);
                          setInvoiceResult(result);
                        } catch (err: any) {
                          Alert.alert("Scan Failed", err.message || "Could not read the invoice.");
                          setInvoicePreview(null);
                        } finally {
                          setInvoiceProcessing(false);
                        }
                      };
                      reader.readAsDataURL(file);
                    } catch {
                      setInvoiceProcessing(false);
                    }
                  };
                  input.click();
                }}
                disabled={invoiceProcessing}
              >
                {invoiceProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitText}>Upload Invoice Photo</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : invoicePreview ? (
            // Show preview while processing
            <View style={{ flex: 1 }}>
              <Image source={{ uri: invoicePreview }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />
              {invoiceProcessing && (
                <View style={[s.overlay, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={[s.scanText, { marginTop: spacing.md }]}>Reading invoice...</Text>
                </View>
              )}
            </View>
          ) : (
            // Camera viewfinder for invoice
            <>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={s.overlay}>
                <View style={s.invoiceFrame} />
                <Text style={s.scanText}>
                  Position the invoice in frame
                </Text>
              </View>
              <TouchableOpacity
                style={[s.captureBtn, { backgroundColor: colors.primary }]}
                onPress={handleTakeInvoicePhoto}
                disabled={invoiceProcessing}
              >
                <View style={s.captureBtnInner} />
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
    permText: { fontSize: fontSize.md, textAlign: "center", marginTop: spacing.md },
    scannerContainer: { flex: 1 },
    overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
    scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: "#fff", borderRadius: 12 },
    invoiceFrame: { width: 300, height: 400, borderWidth: 2, borderColor: "#fff", borderRadius: 12 },
    scanText: { color: "#fff", fontSize: fontSize.md, marginTop: spacing.md, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    viewListBtn: { position: "absolute", bottom: 40, alignSelf: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 25 },
    viewListText: { color: "#fff", fontWeight: "700", fontSize: fontSize.md },
    listContainer: { flex: 1, paddingTop: spacing.md },
    listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    listTitle: { fontSize: fontSize.lg, fontWeight: "700" },
    scanMoreBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    scanMoreText: { color: "#fff", fontWeight: "600", fontSize: fontSize.sm },
    itemCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: 10, padding: spacing.md },
    itemRow: { flexDirection: "row", alignItems: "center" },
    itemInfo: { flex: 1 },
    itemName: { fontSize: fontSize.md, fontWeight: "600" },
    itemDetail: { fontSize: fontSize.xs, marginTop: 2 },
    poTag: { fontSize: fontSize.xs, fontWeight: "600", marginTop: 2 },
    qtyContainer: { alignItems: "center", marginRight: spacing.sm },
    qtyInput: { borderRadius: 8, width: 60, textAlign: "center", padding: spacing.sm, fontSize: fontSize.md, fontWeight: "700", borderWidth: 1 },
    qtyDisplay: { fontSize: fontSize.lg, fontWeight: "700" },
    unitLabel: { fontSize: fontSize.xs, marginTop: 2 },
    removeBtn: { padding: spacing.sm },
    removeText: { fontSize: fontSize.lg },
    submitBtn: { margin: spacing.lg, padding: spacing.md, borderRadius: 12, alignItems: "center" },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },

    // Mode toggle
    modeToggle: {
      flexDirection: "row",
      marginHorizontal: spacing.lg,
      marginVertical: spacing.sm,
      borderRadius: 10,
      padding: 3,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      alignItems: "center",
    },
    modeBtnText: {
      fontSize: fontSize.sm,
      fontWeight: "600",
      color: colors.textSecondary,
    },

    // Invoice review
    invoiceHeader: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: 10,
      padding: spacing.md,
    },
    invoiceMetaRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: 4,
    },
    invoiceTotal: {
      fontSize: fontSize.md,
      fontWeight: "700",
      marginTop: spacing.sm,
    },
    sectionLabel: {
      fontSize: fontSize.xs,
      fontWeight: "700",
      letterSpacing: 1,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    matchBadge: {
      fontSize: fontSize.xs,
      fontWeight: "600",
      marginTop: 2,
    },
    invoiceActions: {
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      alignItems: "center",
    },

    // Capture button
    captureBtn: {
      position: "absolute",
      bottom: 40,
      alignSelf: "center",
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: "center",
      alignItems: "center",
    },
    captureBtnInner: {
      width: 58,
      height: 58,
      borderRadius: 29,
      borderWidth: 3,
      borderColor: "#fff",
      backgroundColor: "transparent",
    },
  });
