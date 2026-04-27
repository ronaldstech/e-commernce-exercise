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

// add product with image before body parsers
app.post("/add-product", async (req, res) => {
    try {
        const response = await fetch("http://localhost:4000/api/products", {
            method: "POST",
            headers: {
                "content-type": req.headers["content-type"]
            },
            body: req,
            duplex: "half"
        });

        if (response.ok) {
            return res.redirect("/home");
        } else {
            return res.redirect("/home");
        }

    } catch (e) {
        console.log(e);
        res.redirect("/home");
    }
});

app.use(express.urlencoded({extended:true}));
app.use(express.json());

//routes implementation
app.get("/login", (req, res) =>{
    res.render("login", {error: null});
})

//rendering home
app.get("/home", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }

    try {
        const categoryId = req.query.categoryId;

        const [catRes, prodRes] = await Promise.all([
            fetch("http://localhost:4000/api/categories"),
            fetch("http://localhost:4000/api/products")
        ]);

        const categories = await catRes.json();
        let products = await prodRes.json();

        // ✅ only filter if categoryId exists
        if (categoryId && categoryId !== "all") {
            products = products.filter(p => p.categoryId == categoryId);
        }

        res.render("home", {
            categories,
            products,
            user: req.session.user,
            selectedCategory: categoryId || "all"
        });

    } catch (e) {
        console.log(e);
        res.render("home", {
            categories: [],
            products: [],
            user: req.session.user,
            selectedCategory: "all"
        });
    }
});

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
        const response = await fetch(`http://localhost:4000/api/orders`);
        const orders = await response.json();

        const usersRes = await fetch("http://localhost:4000/api/users");
        const users = await usersRes.json();

        const userMap = {};
        users.forEach(u => {
            userMap[u.id] = u;
        });

        const enrichedOrders = orders.map(order => ({
            ...order,
            user: userMap[order.userId] || null
        }));

        const total = orders.reduce((sum, o)=> {
            return sum + (o.total || 0);
        }, 0);

        res.render("orders", { orders: enrichedOrders, user: req.session.user, total});

    } catch (e) {
        console.log(e);
        res.render("orders", { orders: [] });
    }
});

//logout
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
            return res.redirect("/home");
        }

        // clear session cookie
        res.clearCookie("connect.sid");

        res.redirect("/login");
    });
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
    
});

//add new product
app.get("/add-product", async (req, res) =>{
    const catResponse = await fetch("http://localhost:4000/api/categories");
    const categories = await catResponse.json();

    res.render("add-product", {categories});
});

app.listen(PORT, () => {
    console.log("Server started");
});
