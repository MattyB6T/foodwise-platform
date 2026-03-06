import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useStore } from "../contexts/StoreContext";
import { api } from "../utils/api";
import { colors, fontSize, spacing } from "../utils/theme";
import { StorePicker } from "../components/StorePicker";

export function OrderReviewScreen() {
  const { selectedStoreId } = useStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editedLines, setEditedLines] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedStoreId) return;
    api
      .getPurchaseOrders(selectedStoreId)
      .then((res) => setOrders(res.orders || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedStoreId]);

  const selectOrder = (order: any) => {
    setSelectedOrder(order);
    setEditedLines(
      order.lines.map((line: any) => ({ ...line }))
    );
  };

  const updateLineQty = (index: number, qty: string) => {
    const num = parseInt(qty, 10);
    if (isNaN(num)) return;
    setEditedLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, quantityOrdered: num } : line
      )
    );
  };

  const approveOrder = async () => {
    if (!selectedOrder) return;
    Alert.alert(
      "Approve Order",
      `Submit this purchase order to ${selectedOrder.supplierName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              // In a real app, this would update the PO status to "submitted"
              Alert.alert("Order Submitted", "Purchase order has been sent to the supplier.");
              setSelectedOrder(null);
              // Refresh orders
              if (selectedStoreId) {
                const res = await api.getPurchaseOrders(selectedStoreId);
                setOrders(res.orders || []);
              }
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  if (!selectedStoreId) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" }}>
          Select a store from the Dashboard first
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (selectedOrder) {
    const totalCost = editedLines.reduce(
      (sum: number, line: any) => sum + line.quantityOrdered * line.unitCost,
      0
    );

    return (
      <View style={styles.container}>
        <View style={styles.orderHeader}>
          <TouchableOpacity onPress={() => setSelectedOrder(null)}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.orderTitle}>{selectedOrder.supplierName}</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  selectedOrder.status === "draft"
                    ? colors.warning
                    : selectedOrder.status === "submitted"
                      ? colors.primaryLight
                      : colors.secondary,
              },
            ]}
          >
            <Text style={styles.statusText}>{selectedOrder.status}</Text>
          </View>
        </View>

        <Text style={styles.deliveryDate}>
          Expected: {selectedOrder.expectedDeliveryDate}
        </Text>

        <FlatList
          data={editedLines}
          keyExtractor={(item, i) => `${item.itemId}-${i}`}
          renderItem={({ item, index }) => (
            <View style={styles.lineCard}>
              <View style={styles.lineInfo}>
                <Text style={styles.lineName}>{item.itemName}</Text>
                <Text style={styles.lineDetail}>
                  ${item.unitCost}/{item.unit}
                  {item.quantityReceived > 0 &&
                    ` | Received: ${item.quantityReceived}`}
                </Text>
              </View>
              {selectedOrder.status === "draft" ? (
                <TextInput
                  style={styles.lineQtyInput}
                  value={item.quantityOrdered.toString()}
                  onChangeText={(val) => updateLineQty(index, val)}
                  keyboardType="numeric"
                />
              ) : (
                <Text style={styles.lineQtyFixed}>
                  {item.quantityOrdered} {item.unit}
                </Text>
              )}
              <Text style={styles.lineCost}>
                ${(item.quantityOrdered * item.unitCost).toFixed(2)}
              </Text>
            </View>
          )}
        />

        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${totalCost.toFixed(2)}</Text>
        </View>

        {selectedOrder.status === "draft" && (
          <TouchableOpacity style={styles.approveBtn} onPress={approveOrder}>
            <Text style={styles.approveText}>Approve & Submit Order</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const draftOrders = orders.filter((o) => o.status === "draft");
  const activeOrders = orders.filter((o) =>
    ["submitted", "partial"].includes(o.status)
  );
  const completedOrders = orders.filter((o) => o.status === "received");

  return (
    <FlatList
      style={styles.container}
      ListHeaderComponent={<StorePicker />}
      data={[
        ...(draftOrders.length > 0
          ? [{ type: "header", title: `Draft Orders (${draftOrders.length})` }, ...draftOrders.map((o) => ({ type: "order", ...o }))]
          : []),
        ...(activeOrders.length > 0
          ? [{ type: "header", title: `Active Orders (${activeOrders.length})` }, ...activeOrders.map((o) => ({ type: "order", ...o }))]
          : []),
        ...(completedOrders.length > 0
          ? [{ type: "header", title: `Completed (${completedOrders.length})` }, ...completedOrders.map((o) => ({ type: "order", ...o }))]
          : []),
      ]}
      keyExtractor={(item: any, i) => item.orderId || `header-${i}`}
      renderItem={({ item }: { item: any }) => {
        if (item.type === "header") {
          return <Text style={styles.sectionHeader}>{item.title}</Text>;
        }
        return (
          <TouchableOpacity
            style={styles.orderCard}
            onPress={() => selectOrder(item)}
          >
            <View style={styles.orderRow}>
              <View>
                <Text style={styles.orderSupplier}>{item.supplierName}</Text>
                <Text style={styles.orderMeta}>
                  {item.lines?.length || 0} items | Expected: {item.expectedDeliveryDate}
                </Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderTotal}>
                  ${item.totalCost?.toFixed(2)}
                </Text>
                <View
                  style={[
                    styles.statusBadgeSm,
                    {
                      backgroundColor:
                        item.status === "draft"
                          ? colors.warning
                          : item.status === "submitted"
                            ? colors.primaryLight
                            : item.status === "partial"
                              ? "#ED8936"
                              : colors.secondary,
                    },
                  ]}
                >
                  <Text style={styles.statusTextSm}>{item.status}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No purchase orders found</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionHeader: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  orderCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 10,
    padding: spacing.md,
  },
  orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderSupplier: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  orderMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  orderRight: { alignItems: "flex-end" },
  orderTotal: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  statusBadgeSm: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  statusTextSm: { color: "#fff", fontSize: fontSize.xs, fontWeight: "600" },
  empty: { padding: spacing.xl, alignItems: "center" },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary },
  // Order detail
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  backBtn: { fontSize: fontSize.md, color: colors.primary, fontWeight: "600" },
  orderTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, flex: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600" },
  deliveryDate: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  lineCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    borderRadius: 8,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  lineInfo: { flex: 1 },
  lineName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  lineDetail: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  lineQtyInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    width: 60,
    textAlign: "center",
    padding: spacing.sm,
    fontSize: fontSize.md,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  lineQtyFixed: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    marginRight: spacing.sm,
  },
  lineCost: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, width: 70, textAlign: "right" },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  totalValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.primary },
  approveBtn: {
    backgroundColor: colors.secondary,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: "center",
  },
  approveText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
});
