"use client";


import Image from "next/image";
import Link from "next/link";
import {motion} from "framer-motion";
import {useState} from "react";



interface Color{

name:string;

image:string;

}





interface Product{


id:string;

name:string;

category?:string;

oldPrice:number;

discount?:number;

price:number;

description?:string;

mainImage:string;

colors?:Color[];

}




interface Props{

product:Product;

}





export default function ProductCard({

product

}:Props){



const [selectedColor,setSelectedColor]=useState(
product.colors?.[0]?.name || ""
);





return(



<motion.div


whileHover={{
y:-15
}}


transition={{
duration:.35
}}



className="
group
relative
luxury-card
overflow-hidden
"

>



{/* IMAGE SECTION */}



<div className="
relative
h-[430px]
overflow-hidden
">


<Image


src={

product.mainImage ||

"/products/default.png"

}


fill


sizes="(max-width:768px) 100vw, 400px"


alt={product.name}


className="
object-cover
transition
duration-700
group-hover:scale-110
"


/>





{/* IMAGE OVERLAY */}


<div className="
absolute
inset-0
bg-gradient-to-t
from-black/80
via-transparent
to-transparent
"/>







{/* CATEGORY */}



{

product.category &&


<div className="
absolute
top-5
left-5
glass
px-5
py-2
rounded-full
text-yellow-400
text-sm
font-bold
">

{product.category}

</div>


}







{/* DISCOUNT */}



{

product.discount &&


<div className="
absolute
right-5
top-5
bg-yellow-500
text-black
px-5
py-2
rounded-full
font-black
text-sm
">

-{product.discount}%

</div>


}





</div>









{/* CONTENT */}



<div className="
p-7
">






<h3 className="
text-2xl
font-black
text-white
">

{product.name}

</h3>








<p className="
text-gray-400
mt-4
text-sm
leading-relaxed
line-clamp-3
">

{

product.description ||

"প্রিমিয়াম কাপড়ের তৈরি ঐতিহ্যবাহী লাক্সারি কালেকশন।"

}

</p>









{/* PRICE */}



<div className="
flex
items-center
gap-4
mt-7
">


{

product.oldPrice > 0 &&


<span className="
text-gray-500
line-through
text-lg
">

৳ {product.oldPrice}

</span>


}




<span className="
text-yellow-400
text-3xl
font-black
">

৳ {product.price}

</span>



</div>









{/* COLORS */}



{

product.colors &&
product.colors.length > 0 &&


<div className="
mt-8
">


<p className="
text-gray-400
text-sm
mb-4
">

রঙ নির্বাচন

</p>





<div className="
flex
gap-4
flex-wrap
">


{


product.colors.map((color,index)=>(



<button


key={index}


onClick={()=>setSelectedColor(color.name)}


className={`

relative

w-12

h-12

rounded-full

overflow-hidden

border-2

transition


${

selectedColor===color.name

?

"border-yellow-400 scale-110"

:

"border-yellow-500/30"

}

`}


title={color.name}


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






{

selectedColor &&


<p className="
text-yellow-400
text-sm
mt-4
">

নির্বাচিত রঙ: {selectedColor}

</p>


}





</div>


}









{/* ACTION */}



<div className="
flex
gap-4
mt-9
">





<Link


href={`/product/${product.id}`}


className="
flex-1
text-center
py-3
rounded-full
border
border-yellow-500/40
text-sm
font-bold
hover:bg-yellow-500
hover:text-black
transition
"

>


বিস্তারিত


</Link>







<button


className="
flex-1
gold-btn
py-3
text-sm
"


>


অর্ডার


</button>






</div>








</div>









</motion.div>



);


}