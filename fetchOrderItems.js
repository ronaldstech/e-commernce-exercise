// Helper to fetch items for a list of orders
const fetchOrderItems = async (orders) => {
    // For each order, fetch its items
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
        const itemsRes = await fetch(`http://localhost:4000/api/orders/${order.id}/items`);
        const items = itemsRes.ok ? await itemsRes.json() : [];
        return { ...order, items };
    }));
    return ordersWithItems;
};
