"use client";


import {
useEffect,
useState
} from "react";


import Image from "next/image";


import {
useParams
} from "next/navigation";


import {
motion
} from "framer-motion";


import {
db
} from "@/lib/firebase";


import {
doc,
getDoc
} from "firebase/firestore";






interface Color{


name:string;

image:string;

}





interface Product{


id:string;

name:string;

category:string;

oldPrice:number;

discount:number;

price:number;

description:string;

mainImage:string;

colors:Color[];

}








export default function ProductDetails(){



const params = useParams();


const id = params.id as string;





const [product,setProduct]=useState<Product|null>(null);


const [loading,setLoading]=useState(true);



const [selectedColor,setSelectedColor]=useState("");









const loadProduct=async()=>{


try{


const snap = await getDoc(

doc(
db,
"products",
id
)

);





if(snap.exists()){



const data=snap.data();




const productData={


id:snap.id,


name:data.name || "",


category:data.category || "",


oldPrice:Number(data.oldPrice || 0),


discount:Number(data.discount || 0),


price:Number(data.price || 0),


description:data.description || "",


mainImage:data.mainImage || "/products/pink.png",


colors:Array.isArray(data.colors)

?

data.colors

:

[]



};



setProduct(productData);



if(productData.colors.length){

setSelectedColor(
productData.colors[0].name
);

}


}




}

catch(error){

console.log(
"Product error:",
error
);

}

finally{


setLoading(false);


}



};









useEffect(()=>{


if(id){

loadProduct();

}


},[id]);









if(loading){


return(


<div className="
min-h-screen
bg-black
text-white
flex
items-center
justify-center
">


<p className="
text-yellow-400
text-2xl
font-bold
">

Loading...

</p>


</div>


);


}









if(!product){


return(


<div className="
min-h-screen
bg-black
text-white
flex
items-center
justify-center
">


<h2 className="
text-3xl
text-yellow-400
">

Product পাওয়া যায়নি

</h2>


</div>


);


}









return(



<main className="
min-h-screen
bg-gradient-to-b
from-black
via-[#100d05]
to-black
text-white
py-32
px-6
">






<div className="
max-w-7xl
mx-auto
grid
md:grid-cols-2
gap-14
items-center
">







{/* IMAGE */}



<motion.div


initial={{
opacity:0,
x:-40
}}


animate={{
opacity:1,
x:0
}}



className="
relative
h-[650px]
rounded-[40px]
overflow-hidden
border
border-yellow-500/30
"


>


<Image


src={product.mainImage}


fill


alt={product.name}


className="
object-cover
"


/>



</motion.div>









{/* DETAILS */}



<motion.div


initial={{
opacity:0,
x:40
}}


animate={{
opacity:1,
x:0
}}



>


<p className="
text-yellow-400
tracking-[5px]
uppercase
">

{product.category}

</p>







<h1 className="
text-5xl
font-black
mt-5
">

{product.name}

</h1>







<p className="
text-gray-400
mt-6
leading-relaxed
text-lg
">

{product.description}

</p>









<div className="
flex
gap-5
items-center
mt-8
">


{

product.oldPrice > 0 &&


<span className="
line-through
text-gray-500
text-xl
">

৳ {product.oldPrice}

</span>


}





<span className="
text-yellow-400
text-4xl
font-black
">

৳ {product.price}

</span>



</div>









{/* COLORS */}




{

product.colors.length > 0 &&


<div className="
mt-10
">


<h3 className="
text-xl
font-bold
">

রঙ নির্বাচন

</h3>




<div className="
flex
gap-5
mt-5
">

{


product.colors.map((color,index)=>(


<button


key={index}


onClick={()=>setSelectedColor(color.name)}


className={`

relative

w-16

h-16

rounded-full

overflow-hidden

border-4


${

selectedColor===color.name

?

"border-yellow-400 scale-110"

:

"border-gray-700"

}

`}


>


<Image

src={color.image}

fill

alt={color.name}

className="
object-cover
"

/>


</button>


))


}


</div>




<p className="
text-yellow-400
mt-4
">

নির্বাচিত: {selectedColor}

</p>



</div>


}









<button className="
gold-btn
mt-12
w-full
text-lg
">

এখনই অর্ডার করুন

</button>






</motion.div>






</div>






</main>



);


}