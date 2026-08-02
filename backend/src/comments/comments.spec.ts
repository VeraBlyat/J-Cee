import { buildTree, CommentNode } from './comments.service';

// Los comentarios llegan de la consulta ordenados por created_at ASC.
function fila(
  id: number,
  parent_id: number | null,
  minuto: number,
): CommentNode {
  return {
    id,
    parent_id,
    content: `comentario ${id}`,
    created_at: `2026-08-01T10:${String(minuto).padStart(2, '0')}:00.000Z`,
    username: 'toby',
    likes: 0,
    dislikes: 0,
    my_vote: 0,
    replies: [],
  };
}

// Aplana el árbol a "id(hijos...)" para comparar la forma de un vistazo.
function forma(nodes: CommentNode[]): string {
  return nodes
    .map((n) => (n.replies.length ? `${n.id}(${forma(n.replies)})` : `${n.id}`))
    .join(' ');
}

describe('buildTree', () => {
  it('deja los comentarios sin padre en la raíz', () => {
    expect(forma(buildTree([fila(1, null, 1), fila(2, null, 2)]))).toBe('2 1');
  });

  it('cuelga las respuestas de su comentario padre', () => {
    const tree = buildTree([
      fila(1, null, 1),
      fila(2, 1, 2),
      fila(3, 1, 3),
    ]);

    expect(forma(tree)).toBe('1(2 3)');
  });

  it('arma varios niveles de anidación', () => {
    const tree = buildTree([
      fila(1, null, 1),
      fila(2, 1, 2),
      fila(3, 2, 3),
    ]);

    expect(forma(tree)).toBe('1(2(3))');
  });

  it('ordena las raíces de la más nueva a la más vieja', () => {
    const tree = buildTree([fila(1, null, 1), fila(2, null, 5), fila(3, null, 3)]);
    expect(tree.map((n) => n.id)).toEqual([2, 3, 1]);
  });

  it('deja las respuestas en orden cronológico, al revés que las raíces', () => {
    // Un hilo se lee en el orden en que se escribió; el listado principal
    // muestra primero lo nuevo.
    const tree = buildTree([
      fila(1, null, 1),
      fila(2, 1, 2),
      fila(3, 1, 5),
      fila(4, 1, 9),
    ]);

    expect(tree[0].replies.map((n) => n.id)).toEqual([2, 3, 4]);
  });

  it('no pierde una respuesta cuyo padre no vino en la lista', () => {
    // Mejor mostrarla fuera de lugar que hacerla desaparecer del hilo.
    const tree = buildTree([fila(1, null, 1), fila(2, 999, 2)]);
    expect(tree.map((n) => n.id).sort()).toEqual([1, 2]);
  });

  it('cada comentario aparece una sola vez', () => {
    const filas = [
      fila(1, null, 1),
      fila(2, 1, 2),
      fila(3, 2, 3),
      fila(4, null, 4),
      fila(5, 4, 5),
    ];

    const contar = (nodes: CommentNode[]) =>
      nodes.reduce((n, node) => n + 1 + contar(node.replies), 0);

    expect(contar(buildTree(filas))).toBe(filas.length);
  });

  it('devuelve una lista vacía si no hay comentarios', () => {
    expect(buildTree([])).toEqual([]);
  });
});
