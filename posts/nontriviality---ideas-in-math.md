#misc 
Start with structure $A$ defined by information inf$(A)$. If a proposition $P$ can be proved about $A$ directly from inf$(A)$, i.e without building new structures $A_i$ and proving propositions iteratively about your new structures and $A$, it is trivial. 

I.e if an idea is nontrivial, you should have to build new things to detect its truth. 

What is the role of the cleverness required? There is information not in front of you (i.e not in inf$(A)$). You need to imagine or recall from elsewhere the extra structure and propositions relating the extra structures to your proposition $P$.

Idea: Can we classify the complexity of such systems? I.e your system may not be as simple as $A \to A_1 \to A_2 \to A_3$, with propositions $P_i$ linking enough information back to $A$ to prove $P$. 

Idea: Network of "systems of information" gives some kind of directed graph, and topological properties of the graph contribute to "nontriviality." 

Idea: Geometry needs to be involved. There should be some notion of how far apart systems are - for example if I need ideas from a distant category to prove things about $A$, this is more nontrivial than using things nearby to $A$. 

Conclusion: Hand-wavily (which is all we need here), non-triviality of an idea comes from the topology of its network of sub-ideas and the conceptual distances between these sub-ideas. You must decide what constitutes a sub-idea and judge the conceptual distances yourself, since I am not interested in trying to define/quantify these things.

Implicitly, an idea is defined inductively as a network of ideas, where you start with some big class of "atomic" ideas. By iterating your measurement of nontriviality through the branches of your idea you want to include, you have some freedom.

I.e if my idea is to cite Faltings's theorem to prove finiteness of rational points on high degree curves, I do not want to include the complexity/nontriviality of Faltings's theorem in my measurement - so I wouldn't iterate and add the complexity of the Faltings' node. 

I.e reduce things all the way to trivialities, (or at least things provable just from definitions, even if they require some tricks/computation), then collapse the subgraphs you don't want to include, i.e the other ideas you are just citing. Topological properties + conceptual distances of this thing should be a good measurement of nontriviality.  
