"use client";


import {
useEffect,
useState
} from "react";

import {
motion
} from "framer-motion";


import {
db
} from "@/lib/firebase";


import {
collection,
getDocs,
query,
orderBy
} from "firebase/firestore";


import ProductCard from "./ProductCard";






interface Color{


name:string;

image:string;

}






interface Product{


id:string;

name:string;

category?:string;

oldPrice:number;

discount:number;

price:number;

description:string;

mainImage:string;

colors:Color[];

}









export default function ProductGrid(){



const [products,setProducts]=useState<Product[]>([]);


const [loading,setLoading]=useState(true);


const [error,setError]=useState("");









const loadProducts=async()=>{


try{


setLoading(true);

setError("");




const q=query(

collection(db,"products"),

orderBy(
"createdAt",
"desc"
)

);





const snapshot=await getDocs(q);






const data:Product[]=snapshot.docs.map(doc=>{


const item=doc.data();




return{


id:doc.id,


name:item.name || "নাম নেই",


category:item.category || "AVEN Collection",


oldPrice:Number(item.oldPrice || 0),


discount:Number(item.discount || 0),


price:Number(item.price || 0),


description:item.description || 
"প্রিমিয়াম লাক্সারি কালেকশন।",



mainImage:item.mainImage || 
"/products/default.png",



colors:

Array.isArray(item.colors)

?

item.colors.map((color:any)=>({


name:color.name || "",


image:color.image || "/products/default.png"


}))

:

[]


};



});







setProducts(data);




}

catch(err){


console.log(
"PRODUCT FETCH ERROR:",
err
);


setError(
"পণ্য লোড করতে সমস্যা হয়েছে"
);


}



finally{


setLoading(false);


}


};









useEffect(()=>{


loadProducts();


},[]);













/* LOADING */



if(loading){



return(


<div className="

grid

sm:grid-cols-2

lg:grid-cols-3

gap-10

">


{

[1,2,3].map(item=>(


<motion.div


key={item}


initial={{
opacity:0
}}


animate={{
opacity:1
}}


className="

h-[600px]

rounded-[35px]

shimmer

"


/>



))


}



</div>



);


}













/* ERROR */



if(error){



return(



<div className="

luxury-card

py-16

text-center

">


<h3 className="

text-2xl

font-bold

text-yellow-400

">

দুঃখিত

</h3>


<p className="

text-gray-400

mt-3

">

{error}

</p>


<button

onClick={loadProducts}

className="
gold-btn
mt-6
"

>

আবার চেষ্টা করুন

</button>



</div>



);


}












/* EMPTY */



if(products.length===0){


return(


<div className="

luxury-card

py-20

text-center

">


<div className="

text-5xl

mb-5

">

🛍️

</div>



<h3 className="

text-2xl

font-bold

text-yellow-400

">

কোন পণ্য পাওয়া যায়নি

</h3>




<p className="

text-gray-400

mt-3

">

খুব শীঘ্রই নতুন কালেকশন আসছে।

</p>



</div>



);


}












return(



<div>




<div className="

flex

justify-between

items-center

mb-10

">


<p className="

text-gray-400

">

মোট পণ্য:

<span className="
text-yellow-400
font-bold
ml-2
">

{products.length}

</span>

</p>




<button

onClick={loadProducts}

className="

border

border-yellow-500/40

px-5

py-2

rounded-full

text-sm

hover:bg-yellow-500

hover:text-black

transition

"

>

Refresh

</button>



</div>










<div className="

grid

sm:grid-cols-2

lg:grid-cols-3

gap-10

">






{


products.map((product,index)=>(



<motion.div


key={product.id}


initial={{

opacity:0,

y:30

}}


animate={{

opacity:1,

y:0

}}


transition={{

delay:index*.08

}}



>


<ProductCard

product={product}

/>


</motion.div>



))


}







</div>







</div>



);


}