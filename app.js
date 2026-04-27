const express = require('express');
const session = require("express-session");
const app = express();
const FileStore = require("session-file-store")(session);

app.use(session({
    store: new FileStore({
        path: "./sessions"
    }),
    secret: "1234",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 6,
        httpOnly: true,
        sameSite: "lax",
        secure: false
    }
}));

const PORT = 5000;

//configure middlewares
app.set("view engine", "ejs");
app.use(express.urlencoded({extended:true}));
app.use(express.json());

//routes implementation
app.get("/login", (req, res) =>{
    res.render("login", {error: null});
})

//rendering home
app.get("/home", async (req, res) => {
    if(!req.session.user){
        return res.redirect("/login");
    }
    try{
        const response = await fetch("http://localhost:4000/api/categories");
        const proResponse = await fetch("http://localhost:4000/api/products");

        const products = await proResponse.json();
        const categories = await response.json();

        res.render("home", {categories, products, user: req.session.user});
    }
    catch(e){
        res.render("home", {categories: [], products: [], error: "failed to fetch categories"});
    }
})

//adding item to cart
app.get("/add-cart", async (req, res) =>{
    if (!req.session.user) {
        return res.redirect("/login");
    }
    const productId = req.query.id;
    const userId = req.session.user.id;  

    try{
        const response = await fetch("http://localhost:4000/api/cart", {
            method: "POST",
            headers: {
                "Content-Type":"application/json"
            },
            body: JSON.stringify({
                userId: userId
            })
        });
        if(response.ok){
            const data = await response.json();
            const cartId = data.id;
            try{
                const res_add_item = await  fetch("http://localhost:4000/api/cart/item", {
                    method: "POST",
                    headers: {
                        "Content-Type":"application/json"
                    },
                    body: JSON.stringify({
                        cartId: cartId,
                        productId: productId,
                        quantity: 1 
                    })
                });
                if(res_add_item.ok){
                    res.redirect("/home");
                }
            }
            catch(e){
                console.log(e);
            }
        }
    }
    catch(e){
        console.log(e);
    }
})

//logging in
app.post("/login", async (req, res) =>{
    const {username, password} = req.body;
    try{
        const response = await fetch("http://localhost:4000/api/users");
        const users = await response.json();

        const user = users.find((u) => u.username === username && u.email === password);

        if(user){
            req.session.user = user;
            res.redirect("/home");
        }
        else{
            res.render("login", {error: "Incorrect password"});
        }

        //console.log(users);
    }
    catch(e){
        res.render("login", {error: e.message});
    }

});

//rendering product cart
app.get("/product-cart", async(req, res) =>{
    if(!req.session.user){
        res.redirect("/login");
    }
    const userId = req.session.user.id;

    try{
        const response = await fetch(`http://localhost:4000/api/cart/user/${userId}`);
        const cart = await response.json();

        const productRes = await fetch("http://localhost:4000/api/products");
        const products = await productRes.json();

        const productMap = {};
        products.forEach(p => {
            productMap[p.id] = p;
        })

        const enrichedCart = cart.map(item =>({
            ...item, product: productMap[item.productId] || null
        }))

        const total = enrichedCart.reduce((sum, item) => {
            if (!item.product) return sum;

            const price = parseFloat(item.price);
            const qty = item.quantity;

            return sum + (price * qty);
        }, 0);

        res.render("product-cart", {enrichedCart, total});
    }
    catch(e){
        console.log(e);
    }
})

//checkout
app.get("/checkout", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const userId = req.session.user.id;

    try {
        const response = await fetch(`http://localhost:4000/api/orders/checkout/${userId}`, {
            method: "POST"
        });

        if (response.ok) {
            // optional: clear cart or redirect
            return res.redirect("/orders");
        } else {
            console.log("Checkout failed");
            return res.redirect("/product-cart");
        }
    } catch (e) {
        console.log(e);
        res.redirect("/product-cart");
    }
});

//orders
const fetchOrderItems = async (orders) => {
    // For each order, fetch its items
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
        const itemsRes = await fetch(`http://localhost:4000/api/orders/${order.id}/items`);
        const items = itemsRes.ok ? await itemsRes.json() : [];
        return { ...order, items };
    }));
    return ordersWithItems;
};

app.get("/orders", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    const userId = req.session.user.id;

    try {
        // 1. Fetch orders
        const response = await fetch(`http://localhost:4000/api/orders/user/${userId}`);
        const orders = await response.json();

        // 2. Fetch items for each order
        const ordersWithItems = await fetchOrderItems(orders);

        // 3. Fetch products (for enrichment)
        const productRes = await fetch("http://localhost:4000/api/products");
        const products = await productRes.json();

        const productMap = {};
        products.forEach(p => {
            productMap[p.id] = p;
        });

        // 4. Enrich order items with product data
        const enrichedOrders = ordersWithItems.map(order => ({
            ...order,
            items: order.items.map(item => ({
                ...item,
                product: productMap[item.productId] || null
            }))
        }));

        res.render("orders", { orders: enrichedOrders, user: req.session.user });

    } catch (e) {
        console.log(e);
        res.render("orders", { orders: [] });
    }
});

//removing item from cartId
app.get("/remove-item", async (req, res) =>{
    const cartItemId = req.query.cartItemId;

    try{
        const response = await fetch(`http://localhost:4000/api/cart/item/${cartItemId}`, {
            method: "DELETE"
        });

        if(response.ok){
            return res.redirect("/product-cart");
        }
    }
    catch(e){
        console.log(e);
        res.redirect("/product-cart");
    }
});

//increamenting quantity
app.get("/increase-qty", async (req, res) => {
    const cartItemId = req.query.cartItemId;
    const qty = parseInt(req.query.qty);

    const newQty = qty + 1;

    try{
        await fetch(`http://localhost:4000/api/cart/item/${cartItemId}`, {
            method: "PUT",
            headers: {
                "Content-Type":"application/json"
            },
            body: JSON.stringify({
                quantity: newQty
            })
        });

        res.redirect("/product-cart");
    }
    catch(e){
        console.log(e);
        res.redirect("/product-cart");
    }
});

app.get("/decrease-qty", async (req, res) => {
    const cartItemId = req.query.cartItemId;
    const qty = parseInt(req.query.qty);

    const newQty = qty - 1;

    try{
        if(newQty <= 0){
            await fetch(`http://localhost:4000/api/cart/item/${cartItemId}`, {
                method: "DELETE"
            });
        } else {
            await fetch(`http://localhost:4000/api/cart/item/${cartItemId}`, {
                method: "PUT",
                headers: {
                    "Content-Type":"application/json"
                },
                body: JSON.stringify({
                    quantity: newQty
                })
            });
        }

        res.redirect("/product-cart");
    }
    catch(e){
        console.log(e);
        res.redirect("/product-cart");
    }
});

app.get("/product-detail", async (req, res) =>{
    const id = req.query.id;

    const response = await fetch(`http://localhost:4000/api/products/${id}`);
    const product = await response.json();

    res.render("product-detail", {product});
})

app.get("/edit-product", async (req, res) =>{
    const id = req.query.id;

    const response = await fetch(`http://localhost:4000/api/products/${id}`);
    const product = await response.json();

    const catResponse = await fetch("http://localhost:4000/api/categories");
    const categories = await catResponse.json();


    res.render("edit-products", {product, categories});
})

app.post("/edit-product", async (req, res) =>{
    const {productId, product_name, category, price, image, description} = req.body

    try{
        const response = await fetch(`http://localhost:4000/api/products/${productId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: product_name,
                price: price,
                description: description,
                categoryId: 1,
                image: image
            })
        });
        const data = await response.json();
        res.redirect("/home");
    }
    catch(e){
        res.redirect("/home");
    }
    
})

app.listen(PORT, () => {
    console.log("Server started");
});
