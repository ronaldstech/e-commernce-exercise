const express = require('express');
const session = require("express-session");
const app = express();

app.use(session({
    secret: "1234",  
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 6
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

app.get("/product-cart", async(req, res) =>{
    if(!req.session.user){
        res.redirect("/login");
    }
    const userId = req.session.user.id;

    try{
        const response = await fetch(`http://localhost:4000/api/cart/user/${userId}`);
        const cart = await response.json();
        res.render("product-cart", {cart});
    }
    catch(e){
        console.log(e);
    }
})

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
